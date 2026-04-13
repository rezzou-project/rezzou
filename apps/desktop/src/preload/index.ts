// Import Third-party Dependencies
import { contextBridge, ipcRenderer } from "electron";
import type { Repo, RepoDiff, SubmitResult, Provider, Namespace, OperationOverrides, Member } from "@rezzou/core";

contextBridge.exposeInMainWorld("versions", {
  electron: process.versions.electron,
  node: process.versions.node
});

contextBridge.exposeInMainWorld("api", {
  authenticate: (
    token: string,
    provider: Provider
  ): Promise<Namespace[]> => ipcRenderer.invoke("auth:authenticate", { token, provider }),

  loadRepos: (namespace: string): Promise<Repo[]> => ipcRenderer.invoke("auth:loadRepos", namespace),

  scanRepos: (repos: Repo[]): Promise<RepoDiff[]> => ipcRenderer.invoke("engine:scanRepos", repos),

  applyDiff: (
    diff: RepoDiff,
    overrides: OperationOverrides
  ): Promise<SubmitResult> => ipcRenderer.invoke("engine:applyDiff", { diff, overrides }),

  fetchMembers: (namespace: string): Promise<Member[]> => ipcRenderer.invoke("engine:fetchMembers", namespace)
});
