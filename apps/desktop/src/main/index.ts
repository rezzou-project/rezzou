// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";

// Import Third-party Dependencies
import { app, BrowserWindow, shell, ipcMain, safeStorage, dialog } from "electron";
import type { Repo, RepoDiff, ProviderAdapter, Provider, Namespace } from "@rezzou/core";

// Import Internal Dependencies
import {
  handleAuthenticate,
  handleLoadRepos,
  handleScanRepos,
  handleApplyDiff,
  handleGetOperationDefaults,
  handleFetchMembers,
  handleGitHubDeviceStart,
  handleGitHubDevicePoll,
  handleGitLabOAuthStart,
  handleGitLabOAuthCallback,
  type ApplyDiffOptions,
  type GetOperationDefaultsOptions
} from "./handlers.ts";
import { listOperations, registry, type OperationInfo } from "./operation-registry.ts";
import { loadPlugin } from "./plugin-loader.ts";
import { readPluginPaths, addPluginPath } from "./plugins-store.ts";

interface AuthenticateOptions {
  token: string;
  provider: Provider;
}

interface ScanReposPayload {
  repos: Repo[];
  operationId: string;
  inputs: Record<string, unknown>;
}

interface LoadPluginPayload {
  filePath: string;
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
}

// CONSTANTS
const kCredentialsFile = "credentials.json";
const kGitHubClientId = import.meta.env.MAIN_VITE_GITHUB_CLIENT_ID as string;
const kGitLabClientId = import.meta.env.MAIN_VITE_GITLAB_CLIENT_ID as string;

let currentAdapter: ProviderAdapter | null = null;
let mainWindow: BrowserWindow | null = null;
let pendingGitLabVerifier: string | null = null;
let githubDeviceAbortController: AbortController | null = null;

function getCredentialsPath(): string {
  return path.join(app.getPath("userData"), kCredentialsFile);
}

function saveCredentials(token: string, provider: Provider): void {
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(getCredentialsPath(), JSON.stringify({ token: encrypted.toString("base64"), provider }));
}

function loadSavedCredentials(): { token: string; provider: Provider; } | null {
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(credPath, "utf-8")) as Record<string, string>;
    if (!raw.token || !raw.provider) {
      return null;
    }

    const token = safeStorage.decryptString(Buffer.from(raw.token, "base64"));

    return {
      token,
      provider: raw.provider as Provider
    };
  }
  catch {
    return null;
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
    currentAdapter = adapter;
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
        currentAdapter = adapter;
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

  ipcMain.handle("auth:auto-login", async(): Promise<{ namespaces: Namespace[]; provider: Provider; } | null> => {
    const saved = loadSavedCredentials();
    if (!saved) {
      return null;
    }

    try {
      const { adapter, namespaces } = await handleAuthenticate(saved.token, saved.provider);
      currentAdapter = adapter;

      return { namespaces, provider: saved.provider };
    }
    catch {
      return null;
    }
  });

  ipcMain.handle("auth:authenticate", async(_event, options: AuthenticateOptions): Promise<Namespace[]> => {
    const { token, provider } = options;

    const { adapter, namespaces } = await handleAuthenticate(token, provider).catch(toError);

    currentAdapter = adapter;
    saveCredentials(token, provider);

    return namespaces;
  });

  ipcMain.handle("auth:loadRepos", async(_event, namespace: string): Promise<Repo[]> => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleLoadRepos(currentAdapter, namespace).catch(toError);
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
    const { diff, inputs, operationId, overrides } = payload;
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleApplyDiff(currentAdapter, { diff, inputs, operationId, overrides }).catch(toError);
  });

  ipcMain.handle("engine:listOperations", (): OperationInfo[] => listOperations());

  ipcMain.handle("plugin:load", async(_event, payload: LoadPluginPayload): Promise<PluginInfo> => {
    const { filePath } = payload;
    const plugin = await loadPlugin(filePath).catch(toError);

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
    const plugin = await loadPlugin(filePaths[0]).catch(toError);
    addPluginPath(filePaths[0]);

    return { id: plugin.id, name: plugin.name, version: plugin.version };
  });

  ipcMain.handle("plugin:getMissing", (): string[] => missingPluginPaths);

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

  for (const filePath of readPluginPaths()) {
    if (!fs.existsSync(filePath)) {
      missingPluginPaths.push(filePath);
      continue;
    }
    try {
      await loadPlugin(filePath);
    }
    catch {
      missingPluginPaths.push(filePath);
    }
  }

  createWindow();

  registry.on("change", function onRegistryChange() {
    mainWindow?.webContents.send("registry:operationsChanged", registry.list());
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
