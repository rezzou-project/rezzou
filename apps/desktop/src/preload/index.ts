// Import Third-party Dependencies
import { contextBridge, ipcRenderer } from "electron";
import type { Repo, RepoDiff, SubmitResult, Provider, NamespaceType, OperationOverrides, Member } from "@rezzou/core";

contextBridge.exposeInMainWorld("versions", {
  electron: process.versions.electron,
  node: process.versions.node
});

contextBridge.exposeInMainWorld("api", {
  connect: (
    token: string,
    groupPath: string,
    options: { provider: Provider; namespaceType: NamespaceType; }
  ): Promise<Repo[]> => ipcRenderer.invoke("auth:connect", { token, groupPath, ...options }),

  scanRepos: (repos: Repo[]): Promise<RepoDiff[]> => ipcRenderer.invoke("engine:scanRepos", repos),

  applyDiff: (
    diff: RepoDiff,
    overrides: OperationOverrides
  ): Promise<SubmitResult> => ipcRenderer.invoke("engine:applyDiff", { diff, overrides }),

  fetchMembers: (namespace: string): Promise<Member[]> => ipcRenderer.invoke("engine:fetchMembers", namespace)
});
