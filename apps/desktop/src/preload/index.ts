// Import Third-party Dependencies
import { contextBridge, ipcRenderer } from "electron";
import type {
  Repo,
  RepoDiff,
  SubmitResult,
  Provider,
  Namespace,
  Member,
  OperationDefaults,
  OperationOverrides,
  RepoStats
} from "@rezzou/core";

interface PluginInfo {
  id: string;
  name: string;
  version: string;
}

interface FilterInfo {
  id: string;
  name: string;
  description?: string;
}

interface HistoryEntryResult {
  repoName: string;
  repoFullPath: string;
  status: "done" | "error";
  prUrl?: string;
  error?: string;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  operationId: string;
  namespace: string;
  results: HistoryEntryResult[];
}

interface LoadedPluginInfo {
  id: string;
  name: string;
  version: string;
  filePath: string;
  source: "persisted" | "auto-scanned";
}

contextBridge.exposeInMainWorld("versions", {
  electron: process.versions.electron,
  node: process.versions.node
});

contextBridge.exposeInMainWorld("api", {
  authenticate: (
    token: string,
    provider: Provider
  ): Promise<Namespace[]> => ipcRenderer.invoke("auth:authenticate", { token, provider }),

  loadRepos: (
    namespace: string,
    provider: Provider
  ): Promise<Repo[]> => ipcRenderer.invoke("auth:loadRepos", { namespace, provider }),

  scanRepos: (
    repos: Repo[],
    operationId: string,
    inputs: Record<string, unknown>
  ): Promise<RepoDiff[]> => ipcRenderer.invoke("engine:scanRepos", { repos, operationId, inputs }),

  applyDiff: (
    diff: RepoDiff,
    options: { inputs: Record<string, unknown>; operationId: string; overrides?: OperationOverrides; force?: boolean; }
  ): Promise<SubmitResult> => ipcRenderer.invoke("engine:applyDiff", { diff, ...options }),

  checkBranchConflicts: (
    repoPaths: string[],
    branchName: string
  ): Promise<string[]> => ipcRenderer.invoke("engine:checkBranchConflicts", { repoPaths, branchName }),

  listOperations: () => ipcRenderer.invoke("engine:listOperations"),

  getOperationDefaults: (
    operationId: string,
    inputs: Record<string, unknown>
  ): Promise<OperationDefaults> => ipcRenderer.invoke("engine:getOperationDefaults", { operationId, inputs }),

  fetchMembers: (namespace: string): Promise<Member[]> => ipcRenderer.invoke("engine:fetchMembers", namespace),

  getRepoStats: (repoPath: string): Promise<RepoStats> => ipcRenderer.invoke("engine:getRepoStats", { repoPath }),

  autoLogin: (): Promise<{ namespaces: Namespace[]; provider: Provider; }[] | null> => ipcRenderer.invoke("auth:auto-login"),

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
  },

  onOperationsChanged: (
    callback: (ops: { id: string; name: string; description: string; }[]) => void
  ): (() => void) => {
    function listener(_event: unknown, ops: { id: string; name: string; description: string; }[]) {
      callback(ops);
    }
    ipcRenderer.on("registry:operationsChanged", listener);

    return () => ipcRenderer.removeListener("registry:operationsChanged", listener);
  },

  loadPlugin: (filePath: string): Promise<PluginInfo> => ipcRenderer.invoke("plugin:load", { filePath }),

  pickAndLoadPlugin: (): Promise<PluginInfo | null> => ipcRenderer.invoke("plugin:pick-and-load"),

  getMissingPlugins: (): Promise<string[]> => ipcRenderer.invoke("plugin:getMissing"),

  listPlugins: (): Promise<LoadedPluginInfo[]> => ipcRenderer.invoke("plugin:list"),

  unloadPlugin: (filePath: string): Promise<void> => ipcRenderer.invoke("plugin:unload", { filePath }),

  reloadPlugin: (filePath: string): Promise<PluginInfo> => ipcRenderer.invoke("plugin:reload", { filePath }),

  onPluginsChanged: (
    callback: (plugins: LoadedPluginInfo[]) => void
  ): (() => void) => {
    function listener(_event: unknown, plugins: LoadedPluginInfo[]) {
      callback(plugins);
    }
    ipcRenderer.on("registry:pluginsChanged", listener);

    return () => ipcRenderer.removeListener("registry:pluginsChanged", listener);
  },

  listFilters: (): Promise<FilterInfo[]> => ipcRenderer.invoke("engine:listFilters"),

  filterRepos: (
    repos: Repo[],
    filterIds: string[]
  ): Promise<string[]> => ipcRenderer.invoke("engine:filterRepos", { repos, filterIds }),

  onFiltersChanged: (
    callback: (filters: FilterInfo[]) => void
  ): (() => void) => {
    function listener(_event: unknown, filters: FilterInfo[]) {
      callback(filters);
    }
    ipcRenderer.on("registry:filtersChanged", listener);

    return () => ipcRenderer.removeListener("registry:filtersChanged", listener);
  },

  listHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke("history:list"),

  addHistoryEntry: (entry: HistoryEntry): Promise<void> => ipcRenderer.invoke("history:add", { entry })
});
