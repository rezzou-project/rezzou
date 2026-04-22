// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";

// Import Third-party Dependencies
import { app, BrowserWindow, shell, ipcMain, safeStorage, dialog } from "electron";
import { ApiRepoContext, type Repo, type RepoDiff, type ProviderAdapter, type Provider, type Namespace } from "@rezzou/core";

// Import Internal Dependencies
import {
  handleAuthenticate,
  handleLoadRepos,
  handleScanRepos,
  handleApplyDiff,
  handleCheckBranchConflicts,
  handleGetOperationDefaults,
  handleFetchMembers,
  handleGetRepoStats,
  handleGitHubDeviceStart,
  handleGitHubDevicePoll,
  handleGitLabOAuthStart,
  handleGitLabOAuthCallback,
  type ApplyDiffOptions,
  type GetOperationDefaultsOptions
} from "./handlers.ts";
import { listOperations, registry, type OperationInfo } from "./operation-registry.ts";
import { filterRegistry } from "./filter-registry.ts";
import { loadPlugin, unregisterPluginByPath } from "./plugin-loader.ts";
import { readPluginPaths, addPluginPath, removePluginPath, scanPluginsDir } from "./plugins-store.ts";
import { readHistory, addHistoryEntry, type HistoryEntry } from "./history-store.ts";

interface AuthenticateOptions {
  token: string;
  provider: Provider;
}

interface LoadReposPayload {
  namespace: string;
  provider: Provider;
}

interface ScanReposPayload {
  repos: Repo[];
  operationId: string;
  inputs: Record<string, unknown>;
}

interface GetRepoStatsPayload {
  repoPath: string;
}

interface LoadPluginPayload {
  filePath: string;
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
}

interface LoadedPluginInfo {
  id: string;
  name: string;
  version: string;
  filePath: string;
  source: "persisted" | "auto-scanned";
}

interface UnloadPluginPayload {
  filePath: string;
}

interface ReloadPluginPayload {
  filePath: string;
}

interface FilterReposPayload {
  repos: Repo[];
  filterIds: string[];
}

interface CheckBranchConflictsPayload {
  repoPaths: string[];
  branchName: string;
}

interface AddHistoryEntryPayload {
  entry: HistoryEntry;
}

// CONSTANTS
const kCredentialsFile = "credentials.json";
const kGitHubClientId = import.meta.env.MAIN_VITE_GITHUB_CLIENT_ID as string;
const kGitLabClientId = import.meta.env.MAIN_VITE_GITLAB_CLIENT_ID as string;

const adapters = new Map<Provider, ProviderAdapter>();
let currentAdapter: ProviderAdapter | null = null;
let mainWindow: BrowserWindow | null = null;
let pendingGitLabVerifier: string | null = null;
let githubDeviceAbortController: AbortController | null = null;

const loadedPlugins = new Map<string, LoadedPluginInfo>();

function getCredentialsPath(): string {
  return path.join(app.getPath("userData"), kCredentialsFile);
}

function saveCredentials(token: string, provider: Provider): void {
  const credPath = getCredentialsPath();
  let existing: Record<string, string> = {};

  if (fs.existsSync(credPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(credPath, "utf-8")) as Record<string, string>;
    }
    catch {
      // ignore malformed file
    }
  }

  const encrypted = safeStorage.encryptString(token).toString("base64");
  fs.writeFileSync(credPath, JSON.stringify({ ...existing, [provider]: encrypted }));
}

function loadSavedCredentials(): { token: string; provider: Provider; }[] {
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) {
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(credPath, "utf-8")) as Record<string, string>;
    const providers: Provider[] = ["github", "gitlab"];
    const results: { token: string; provider: Provider; }[] = [];

    for (const provider of providers) {
      if (!raw[provider]) {
        continue;
      }

      try {
        const token = safeStorage.decryptString(Buffer.from(raw[provider], "base64"));
        results.push({ token, provider });
      }
      catch {
        // skip corrupted entry
      }
    }

    return results;
  }
  catch {
    return [];
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(import.meta.dirname, "../preload/index.js")
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  }
  else {
    mainWindow.loadFile(path.join(import.meta.dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);

    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function toError(err: unknown): never {
  throw new Error(err instanceof Error ? err.message : String(err));
}

// macOS: URL scheme callback fires on the already-running instance via open-url
app.on("open-url", async(event, url) => {
  event.preventDefault();

  const parsed = new URL(url);
  if (parsed.hostname !== "gitlab" || parsed.pathname !== "/callback") {
    return;
  }

  const code = parsed.searchParams.get("code");
  const verifier = pendingGitLabVerifier;
  pendingGitLabVerifier = null;

  if (!code || !verifier) {
    return;
  }

  try {
    const token = await handleGitLabOAuthCallback(kGitLabClientId, code, verifier);
    const { adapter, namespaces } = await handleAuthenticate(token, "gitlab");
    adapters.set("gitlab", adapter);
    saveCredentials(token, "gitlab");
    mainWindow?.webContents.send("oauth:authenticated", namespaces, "gitlab");
  }
  catch {
    mainWindow?.webContents.send("oauth:error", "GitLab authentication failed");
  }
});

app.whenReady().then(async() => {
  // Register rezzou:// as a custom URL scheme for OAuth callbacks.
  // In production, also configure "protocols" in electron-builder config.
  app.setAsDefaultProtocolClient("rezzou");

  const missingPluginPaths: string[] = [];

  ipcMain.handle("oauth:github-device-start", async(event): Promise<{ user_code: string; verification_uri: string; }> => {
    if (!kGitHubClientId) {
      throw new Error("MAIN_VITE_GITHUB_CLIENT_ID is not set");
    }

    githubDeviceAbortController?.abort();
    githubDeviceAbortController = new AbortController();
    const { signal } = githubDeviceAbortController;

    const { device_code, user_code, verification_uri, interval } = await handleGitHubDeviceStart(kGitHubClientId);
    shell.openExternal(verification_uri);

    handleGitHubDevicePoll({ clientId: kGitHubClientId, deviceCode: device_code, interval, signal })
      .then(async(token) => {
        const { adapter, namespaces } = await handleAuthenticate(token, "github");
        adapters.set("github", adapter);
        saveCredentials(token, "github");
        githubDeviceAbortController = null;
        event.sender.send("oauth:authenticated", namespaces, "github");
      })
      .catch((pollError: unknown) => {
        githubDeviceAbortController = null;
        const isCancelled = pollError instanceof Error &&
          (pollError.message === "OAuth cancelled" || pollError.name === "AbortError");
        if (!isCancelled) {
          const message = pollError instanceof Error ? pollError.message : "Unknown error";
          event.sender.send("oauth:error", message);
        }
      });

    return { user_code, verification_uri };
  });

  ipcMain.handle("oauth:gitlab-start", async() => {
    if (!kGitLabClientId) {
      throw new Error("MAIN_VITE_GITLAB_CLIENT_ID is not set");
    }

    const { url, verifier } = handleGitLabOAuthStart(kGitLabClientId);
    pendingGitLabVerifier = verifier;
    shell.openExternal(url);
  });

  ipcMain.handle("oauth:cancel", () => {
    githubDeviceAbortController?.abort();
    githubDeviceAbortController = null;
    pendingGitLabVerifier = null;
  });

  ipcMain.handle("auth:auto-login", async(): Promise<{ namespaces: Namespace[]; provider: Provider; }[] | null> => {
    const saved = loadSavedCredentials();
    if (saved.length === 0) {
      return null;
    }

    const sessions: { namespaces: Namespace[]; provider: Provider; }[] = [];
    for (const { token, provider } of saved) {
      try {
        const { adapter, namespaces } = await handleAuthenticate(token, provider);
        adapters.set(provider, adapter);
        sessions.push({ namespaces, provider });
      }
      catch {
        // skip failed provider
      }
    }

    return sessions.length > 0 ? sessions : null;
  });

  ipcMain.handle("auth:authenticate", async(_event, options: AuthenticateOptions): Promise<Namespace[]> => {
    const { token, provider } = options;

    const { adapter, namespaces } = await handleAuthenticate(token, provider).catch(toError);

    adapters.set(provider, adapter);
    saveCredentials(token, provider);

    return namespaces;
  });

  ipcMain.handle("auth:loadRepos", async(_event, payload: LoadReposPayload): Promise<Repo[]> => {
    const { namespace, provider } = payload;
    const adapter = adapters.get(provider);
    if (!adapter) {
      throw new Error(`Not connected to ${provider}`);
    }

    currentAdapter = adapter;

    return handleLoadRepos(adapter, namespace).catch(toError);
  });

  ipcMain.handle("engine:scanRepos", async(_event, payload: ScanReposPayload): Promise<RepoDiff[]> => {
    const { repos, operationId, inputs } = payload;
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleScanRepos(
      currentAdapter,
      repos,
      {
        operationId,
        inputs
      }
    ).catch(toError);
  });

  ipcMain.handle("engine:applyDiff", async(_event, payload: ApplyDiffOptions) => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleApplyDiff(currentAdapter, payload).catch(toError);
  });

  ipcMain.handle("engine:checkBranchConflicts", async(_event, payload: CheckBranchConflictsPayload): Promise<string[]> => {
    const { repoPaths, branchName } = payload;
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleCheckBranchConflicts(currentAdapter, { repoPaths, branchName }).catch(toError);
  });

  ipcMain.handle("engine:listOperations", (): OperationInfo[] => listOperations());

  ipcMain.handle("engine:listFilters", () => filterRegistry.list());

  ipcMain.handle("engine:filterRepos", async(_event, payload: FilterReposPayload): Promise<string[]> => {
    const { repos, filterIds } = payload;
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    const filters = filterIds.map((id) => filterRegistry.get(id));
    const passingIds: string[] = [];

    for (const repo of repos) {
      const ctx = new ApiRepoContext(currentAdapter, repo);
      const results = await Promise.all(filters.map((filter) => filter.test(ctx)));
      if (results.every(Boolean)) {
        passingIds.push(repo.id);
      }
    }

    return passingIds;
  });

  ipcMain.handle("plugin:load", async(_event, payload: LoadPluginPayload): Promise<PluginInfo> => {
    const { filePath } = payload;
    const plugin = await loadPlugin(filePath).catch(toError);
    loadedPlugins.set(filePath, {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      filePath,
      source: "persisted"
    });
    mainWindow?.webContents.send("registry:pluginsChanged", [...loadedPlugins.values()]);

    return { id: plugin.id, name: plugin.name, version: plugin.version };
  });

  ipcMain.handle("plugin:pick-and-load", async(): Promise<PluginInfo | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Plugin", extensions: ["js", "mjs", "ts"] }]
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    const filePath = filePaths[0];
    const plugin = await loadPlugin(filePath).catch(toError);
    addPluginPath(filePath);
    loadedPlugins.set(filePath, {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      filePath,
      source: "persisted"
    });
    mainWindow?.webContents.send("registry:pluginsChanged", [...loadedPlugins.values()]);

    return { id: plugin.id, name: plugin.name, version: plugin.version };
  });

  ipcMain.handle("plugin:getMissing", (): string[] => missingPluginPaths);

  ipcMain.handle("plugin:list", (): LoadedPluginInfo[] => [...loadedPlugins.values()]);

  ipcMain.handle("plugin:unload", async(_event, payload: UnloadPluginPayload): Promise<void> => {
    const { filePath } = payload;
    unregisterPluginByPath(filePath);
    removePluginPath(filePath);
    loadedPlugins.delete(filePath);
    mainWindow?.webContents.send("registry:pluginsChanged", [...loadedPlugins.values()]);
  });

  ipcMain.handle("plugin:reload", async(_event, payload: ReloadPluginPayload): Promise<PluginInfo> => {
    const { filePath } = payload;
    unregisterPluginByPath(filePath);
    const plugin = await loadPlugin(filePath).catch(toError);
    const existing = loadedPlugins.get(filePath);
    const info: LoadedPluginInfo = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      filePath,
      source: existing?.source ?? "persisted"
    };
    loadedPlugins.set(filePath, info);
    mainWindow?.webContents.send("registry:pluginsChanged", [...loadedPlugins.values()]);

    return { id: plugin.id, name: plugin.name, version: plugin.version };
  });

  ipcMain.handle("engine:getOperationDefaults", (_event, payload: GetOperationDefaultsOptions) => {
    const { operationId, inputs } = payload;

    return handleGetOperationDefaults({ operationId, inputs });
  });

  ipcMain.handle("engine:fetchMembers", async(_event, namespace: string) => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleFetchMembers(currentAdapter, namespace).catch(toError);
  });

  ipcMain.handle("history:list", (): HistoryEntry[] => readHistory());

  ipcMain.handle("history:add", (_event, payload: AddHistoryEntryPayload): void => {
    const { entry } = payload;
    addHistoryEntry(entry);
  });

  ipcMain.handle("engine:getRepoStats", async(_event, payload: GetRepoStatsPayload) => {
    const { repoPath } = payload;
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleGetRepoStats(currentAdapter, repoPath).catch(toError);
  });

  const persistedPaths = readPluginPaths();

  for (const filePath of persistedPaths) {
    if (!fs.existsSync(filePath)) {
      missingPluginPaths.push(filePath);
      continue;
    }
    try {
      const plugin = await loadPlugin(filePath);
      loadedPlugins.set(filePath, {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        filePath,
        source: "persisted"
      });
    }
    catch {
      missingPluginPaths.push(filePath);
    }
  }

  for (const filePath of scanPluginsDir()) {
    if (persistedPaths.includes(filePath)) {
      continue;
    }
    try {
      const plugin = await loadPlugin(filePath);
      loadedPlugins.set(filePath, {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        filePath,
        source: "auto-scanned"
      });
    }
    catch {
      // silently skip unloadable auto-scanned plugins
    }
  }

  createWindow();

  registry.on("change", function onRegistryChange() {
    mainWindow?.webContents.send("registry:operationsChanged", registry.list());
  });

  filterRegistry.on("change", function onFilterRegistryChange() {
    mainWindow?.webContents.send("registry:filtersChanged", filterRegistry.list());
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
