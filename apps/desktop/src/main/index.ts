// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";

// Import Third-party Dependencies
import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";
import {
  ApiRepoContext,
  RezzouError,
  type Repo,
  type RepoDiff,
  type ProviderAdapter,
  type Namespace
} from "@rezzou/core";

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
  type GetOperationDefaultsOptions
} from "./handlers.ts";
import { listOperations, registry } from "./operation-registry.ts";
import { filterRegistry } from "./filter-registry.ts";
import { providerRegistry } from "./provider-registry.ts";
import { loadPlugin, unregisterPluginByPath } from "./plugin-loader.ts";
import { readPluginPaths, addPluginPath, removePluginPath, scanPluginsDir } from "./plugins-store.ts";
import { readHistory, recordRun } from "./history-store.ts";
import { saveCredentials, loadSavedCredentials } from "./credentials-store.ts";
import {
  IpcChannels,
  type AuthenticateOptions,
  type LoadReposPayload,
  type ScanReposPayload,
  type ApplyDiffPayload,
  type FetchMembersPayload,
  type GetRepoStatsPayload,
  type LoadPluginPayload,
  type PluginInfo,
  type LoadedPluginInfo,
  type UnloadPluginPayload,
  type ReloadPluginPayload,
  type FilterReposPayload,
  type CheckBranchConflictsPayload,
  type RecordRunPayload,
  type ProviderInfo
} from "../shared/ipc-channels.ts";

// CONSTANTS
const kGitHubClientId = import.meta.env.MAIN_VITE_GITHUB_CLIENT_ID as string;
const kGitLabClientId = import.meta.env.MAIN_VITE_GITLAB_CLIENT_ID as string;

const adapters = new Map<string, ProviderAdapter>();
let mainWindow: BrowserWindow | null = null;
let pendingGitLabVerifier: string | null = null;
let githubDeviceAbortController: AbortController | null = null;

const loadedPlugins = new Map<string, LoadedPluginInfo>();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getAdapter(provider: string): ProviderAdapter {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new Error(`Not connected to ${provider}`);
  }

  return adapter;
}

function serializeError(err: unknown): never {
  if (err instanceof RezzouError) {
    throw new Error(JSON.stringify({ code: err.code, message: err.message, details: err.details }));
  }

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
    mainWindow?.webContents.send(IpcChannels.OAuthAuthenticated, namespaces, "gitlab");
  }
  catch {
    mainWindow?.webContents.send(IpcChannels.OAuthError, "GitLab authentication failed");
  }
});

app.whenReady().then(async() => {
  // Register rezzou:// as a custom URL scheme for OAuth callbacks.
  // In production, also configure "protocols" in electron-builder config.
  app.setAsDefaultProtocolClient("rezzou");

  const missingPluginPaths: string[] = [];

  ipcMain.handle(IpcChannels.OAuthGitHubDeviceStart, async(event): Promise<{ user_code: string; verification_uri: string; }> => {
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
        event.sender.send(IpcChannels.OAuthAuthenticated, namespaces, "github");
      })
      .catch((pollError: unknown) => {
        githubDeviceAbortController = null;
        const isCancelled = pollError instanceof Error &&
          (pollError.message === "OAuth cancelled" || pollError.name === "AbortError");
        if (!isCancelled) {
          const message = pollError instanceof Error ? pollError.message : "Unknown error";
          event.sender.send(IpcChannels.OAuthError, message);
        }
      });

    return { user_code, verification_uri };
  });

  ipcMain.handle(IpcChannels.OAuthGitLabStart, async() => {
    if (!kGitLabClientId) {
      throw new Error("MAIN_VITE_GITLAB_CLIENT_ID is not set");
    }

    const { url, verifier } = handleGitLabOAuthStart(kGitLabClientId);
    pendingGitLabVerifier = verifier;
    shell.openExternal(url);
  });

  ipcMain.handle(IpcChannels.OAuthCancel, () => {
    githubDeviceAbortController?.abort();
    githubDeviceAbortController = null;
    pendingGitLabVerifier = null;
  });

  ipcMain.handle(IpcChannels.AuthAutoLogin, async(): Promise<{ namespaces: Namespace[]; provider: Provider; }[] | null> => {
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

  ipcMain.handle(IpcChannels.AuthAuthenticate, async(_event, payload: AuthenticateOptions): Promise<Namespace[]> => {
    const { token, provider } = payload;

    const { adapter, namespaces } = await handleAuthenticate(token, provider).catch(serializeError);

    adapters.set(provider, adapter);
    saveCredentials(token, provider);

    return namespaces;
  });

  ipcMain.handle(IpcChannels.AuthLoadRepos, async(_event, payload: LoadReposPayload): Promise<Repo[]> => {
    const { namespace, provider } = payload;

    return handleLoadRepos(getAdapter(provider), namespace).catch(serializeError);
  });

  ipcMain.handle(IpcChannels.EngineScanRepos, async(_event, payload: ScanReposPayload): Promise<RepoDiff[]> => {
    const { repos, operationId, inputs, provider } = payload;

    return handleScanRepos(
      getAdapter(provider),
      repos,
      { operationId, inputs }
    ).catch(serializeError);
  });

  ipcMain.handle(IpcChannels.EngineApplyDiff, async(_event, payload: ApplyDiffPayload) => {
    const { provider, ...options } = payload;

    return handleApplyDiff(getAdapter(provider), options).catch(serializeError);
  });

  ipcMain.handle(IpcChannels.EngineCheckBranchConflicts,
    async(_event, payload: CheckBranchConflictsPayload): Promise<string[]> => {
      const { repoPaths, branchName, provider } = payload;

      return handleCheckBranchConflicts(getAdapter(provider), { repoPaths, branchName }).catch(serializeError);
    });

  ipcMain.handle(IpcChannels.EngineListOperations, () => listOperations());

  ipcMain.handle(IpcChannels.EngineListFilters, () => filterRegistry.list());

  ipcMain.handle(IpcChannels.EngineFilterRepos, async(_event, payload: FilterReposPayload): Promise<string[]> => {
    const { repos, filterIds, provider } = payload;
    const adapter = getAdapter(provider);
    const filters = filterIds.map((id) => filterRegistry.get(id));
    const passingIds: string[] = [];

    for (const repo of repos) {
      const ctx = new ApiRepoContext(adapter, repo);
      const results = await Promise.all(filters.map((filter) => filter.test(ctx)));
      if (results.every(Boolean)) {
        passingIds.push(repo.id);
      }
    }

    return passingIds;
  });

  ipcMain.handle(IpcChannels.PluginLoad, async(_event, payload: LoadPluginPayload): Promise<PluginInfo> => {
    const { filePath } = payload;
    const plugin = await loadPlugin(filePath).catch(serializeError);
    loadedPlugins.set(filePath, {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      filePath,
      source: "persisted"
    });
    mainWindow?.webContents.send(IpcChannels.RegistryPluginsChanged, [...loadedPlugins.values()]);

    return { id: plugin.id, name: plugin.name, version: plugin.version };
  });

  ipcMain.handle(IpcChannels.PluginPickAndLoad, async(): Promise<PluginInfo | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Plugin", extensions: ["js", "mjs", "ts"] }]
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    const filePath = filePaths[0];
    const plugin = await loadPlugin(filePath).catch(serializeError);
    addPluginPath(filePath);
    loadedPlugins.set(filePath, {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      filePath,
      source: "persisted"
    });
    mainWindow?.webContents.send(IpcChannels.RegistryPluginsChanged, [...loadedPlugins.values()]);

    return { id: plugin.id, name: plugin.name, version: plugin.version };
  });

  ipcMain.handle(IpcChannels.PluginGetMissing, (): string[] => missingPluginPaths);

  ipcMain.handle(IpcChannels.PluginList, (): LoadedPluginInfo[] => [...loadedPlugins.values()]);

  ipcMain.handle(IpcChannels.PluginUnload, async(_event, payload: UnloadPluginPayload): Promise<void> => {
    const { filePath } = payload;
    unregisterPluginByPath(filePath);
    removePluginPath(filePath);
    loadedPlugins.delete(filePath);
    mainWindow?.webContents.send(IpcChannels.RegistryPluginsChanged, [...loadedPlugins.values()]);
  });

  ipcMain.handle(IpcChannels.PluginReload, async(_event, payload: ReloadPluginPayload): Promise<PluginInfo> => {
    const { filePath } = payload;
    unregisterPluginByPath(filePath);
    const plugin = await loadPlugin(filePath).catch(serializeError);
    const existing = loadedPlugins.get(filePath);
    const info: LoadedPluginInfo = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      filePath,
      source: existing?.source ?? "persisted"
    };
    loadedPlugins.set(filePath, info);
    mainWindow?.webContents.send(IpcChannels.RegistryPluginsChanged, [...loadedPlugins.values()]);

    return { id: plugin.id, name: plugin.name, version: plugin.version };
  });

  ipcMain.handle(IpcChannels.EngineGetOperationDefaults, (_event, payload: GetOperationDefaultsOptions) => {
    const { operationId, inputs } = payload;

    return handleGetOperationDefaults({ operationId, inputs });
  });

  ipcMain.handle(IpcChannels.EngineFetchMembers, async(_event, payload: FetchMembersPayload) => {
    const { namespace, provider } = payload;

    return handleFetchMembers(getAdapter(provider), namespace).catch(serializeError);
  });

  ipcMain.handle(IpcChannels.HistoryList, () => readHistory());

  ipcMain.handle(IpcChannels.HistoryRecord, (_event, payload: RecordRunPayload): void => {
    recordRun(payload);
  });

  ipcMain.handle(IpcChannels.ProviderList, (): ProviderInfo[] => providerRegistry.list());

  ipcMain.handle(IpcChannels.EngineGetRepoStats, async(_event, payload: GetRepoStatsPayload) => {
    const { repoPath, provider } = payload;

    return handleGetRepoStats(getAdapter(provider), repoPath).catch(serializeError);
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
    mainWindow?.webContents.send(IpcChannels.RegistryOperationsChanged, registry.list());
  });

  filterRegistry.on("change", function onFilterRegistryChange() {
    mainWindow?.webContents.send(IpcChannels.RegistryFiltersChanged, filterRegistry.list());
  });

  providerRegistry.on("change", function onProviderRegistryChange() {
    mainWindow?.webContents.send(IpcChannels.RegistryProvidersChanged, providerRegistry.list());
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
