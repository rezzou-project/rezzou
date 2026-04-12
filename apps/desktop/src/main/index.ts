// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";

// Import Third-party Dependencies
import { app, BrowserWindow, shell, ipcMain, safeStorage } from "electron";
import type { Repo, RepoDiff, ProviderAdapter } from "@rezzou/core";

// Import Internal Dependencies
import { handleConnect, handleScanRepos, handleApplyDiff } from "./handlers.ts";

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
  ipcMain.handle("auth:connect", async(_event, token: string, groupPath: string): Promise<Repo[]> => {
    const { adapter, repos } = await handleConnect(token, groupPath).catch(toError);

    currentAdapter = adapter;
    saveToken(token);

    return repos;
  });

  ipcMain.handle("engine:scanRepos", async(_event, repos: Repo[]): Promise<RepoDiff[]> => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleScanRepos(currentAdapter, repos).catch(toError);
  });

  ipcMain.handle("engine:applyDiff", async(_event, diff: RepoDiff) => {
    if (currentAdapter === null) {
      throw new Error("Not connected");
    }

    return handleApplyDiff(currentAdapter, diff).catch(toError);
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
