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

  scanRepos: (
    repos: Repo[],
    operationId: string
  ): Promise<RepoDiff[]> => ipcRenderer.invoke("engine:scanRepos", { repos, operationId }),

  applyDiff: (
    diff: RepoDiff,
    overrides: OperationOverrides,
    operationId: string
  ): Promise<SubmitResult> => ipcRenderer.invoke("engine:applyDiff", { diff, overrides, operationId }),

  fetchMembers: (namespace: string): Promise<Member[]> => ipcRenderer.invoke("engine:fetchMembers", namespace),

  autoLogin: (): Promise<{ namespaces: Namespace[]; provider: Provider; } | null> => ipcRenderer.invoke("auth:auto-login"),

  startGitHubOAuth: (): Promise<{
    user_code: string;
    verification_uri: string;
  }> => ipcRenderer.invoke("oauth:github-device-start"),

  startGitLabOAuth: (): Promise<void> => ipcRenderer.invoke("oauth:gitlab-start"),

  cancelOAuth: (): Promise<void> => ipcRenderer.invoke("oauth:cancel"),

  onOAuthAuthenticated: (
    callback: (namespaces: Namespace[], provider: Provider) => void
  ): (() => void) => {
    function listener(_event: unknown, namespaces: Namespace[], provider: Provider) {
      callback(namespaces, provider);
    }
    ipcRenderer.on("oauth:authenticated", listener);

    return () => ipcRenderer.removeListener("oauth:authenticated", listener);
  },

  onOAuthError: (callback: (message: string) => void): (() => void) => {
    function listener(_event: unknown, message: string) {
      callback(message);
    }
    ipcRenderer.on("oauth:error", listener);

    return () => ipcRenderer.removeListener("oauth:error", listener);
  }
});
