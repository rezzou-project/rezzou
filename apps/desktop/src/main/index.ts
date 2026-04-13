// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";

// Import Third-party Dependencies
import { app, BrowserWindow, shell, ipcMain, safeStorage } from "electron";
import type { Repo, RepoDiff, ProviderAdapter, Provider, OperationOverrides, Namespace } from "@rezzou/core";

// Import Internal Dependencies
import { handleAuthenticate, handleLoadRepos, handleScanRepos, handleApplyDiff, handleFetchMembers } from "./handlers.ts";

interface AuthenticateOptions {
  token: string;
  provider: Provider;
}

// CONSTANTS
const kCredentialsFile = "credentials.json";

let currentAdapter: ProviderAdapter | null = null;

function getCredentialsPath(): string {
  return path.join(app.getPath("userData"), kCredentialsFile);
}

function saveToken(token: string): void {
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(getCredentialsPath(), JSON.stringify({ token: encrypted.toString("base64") }));
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  }
  else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);

    return { action: "deny" };
  });
}

function toError(err: unknown): never {
  throw new Error(err instanceof Error ? err.message : String(err));
}

app.whenReady().then(() => {
  ipcMain.handle("auth:authenticate", async(_event, options: AuthenticateOptions): Promise<Namespace[]> => {
    const { token, provider } = options;

    const { adapter, namespaces } = await handleAuthenticate(token, provider).catch(toError);

    currentAdapter = adapter;
    saveToken(token);

    return namespaces;
  });

  ipcMain.handle("auth:loadRepos", async(_event, namespace: string): Promise<Repo[]> => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleLoadRepos(currentAdapter, namespace).catch(toError);
  });

  ipcMain.handle("engine:scanRepos", async(_event, repos: Repo[]): Promise<RepoDiff[]> => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleScanRepos(currentAdapter, repos).catch(toError);
  });

  ipcMain.handle("engine:applyDiff", async(_event, { diff, overrides }: { diff: RepoDiff; overrides: OperationOverrides; }) => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleApplyDiff(currentAdapter, diff, overrides).catch(toError);
  });

  ipcMain.handle("engine:fetchMembers", async(_event, namespace: string) => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleFetchMembers(currentAdapter, namespace).catch(toError);
  });

  createWindow();

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
