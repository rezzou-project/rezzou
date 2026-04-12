// Import Third-party Dependencies
import { contextBridge, ipcRenderer } from "electron";
import type { Repo, RepoDiff, SubmitResult } from "@rezzou/core";

contextBridge.exposeInMainWorld("versions", {
  electron: process.versions.electron,
  node: process.versions.node
});

contextBridge.exposeInMainWorld("api", {
  connect: (token: string, groupPath: string): Promise<Repo[]> => ipcRenderer.invoke("auth:connect", token, groupPath),

  scanRepos: (repos: Repo[]): Promise<RepoDiff[]> => ipcRenderer.invoke("engine:scanRepos", repos),

  applyDiff: (diff: RepoDiff): Promise<SubmitResult> => ipcRenderer.invoke("engine:applyDiff", diff)
});
