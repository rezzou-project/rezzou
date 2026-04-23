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

// Import Internal Dependencies
import {
  IpcChannels,
  type IpcApi,
  type OperationInfo,
  type PluginInfo,
  type FilterInfo,
  type HistoryEntry,
  type RecordRunPayload,
  type LoadedPluginInfo
} from "../shared/ipc-channels.ts";

contextBridge.exposeInMainWorld("versions", {
  electron: process.versions.electron,
  node: process.versions.node
});

contextBridge.exposeInMainWorld("api", {
  authenticate: (
    token: string,
    provider: Provider
  ): Promise<Namespace[]> => ipcRenderer.invoke(IpcChannels.AuthAuthenticate, { token, provider }),

  loadRepos: (
    namespace: string,
    provider: Provider
  ): Promise<Repo[]> => ipcRenderer.invoke(IpcChannels.AuthLoadRepos, { namespace, provider }),

  scanRepos: (
    repos: Repo[],
    operationId: string,
    options: { inputs: Record<string, unknown>; provider: Provider; }
  ): Promise<RepoDiff[]> => ipcRenderer.invoke(IpcChannels.EngineScanRepos, { repos, operationId, ...options }),

  applyDiff: (
    diff: RepoDiff,
    options: {
      inputs: Record<string, unknown>;
      operationId: string;
      overrides?: OperationOverrides;
      force?: boolean;
      provider: Provider;
    }
  ): Promise<SubmitResult> => ipcRenderer.invoke(IpcChannels.EngineApplyDiff, { diff, ...options }),

  checkBranchConflicts: (
    repoPaths: string[],
    branchName: string,
    provider: Provider
  ): Promise<string[]> => ipcRenderer.invoke(IpcChannels.EngineCheckBranchConflicts, { repoPaths, branchName, provider }),

  listOperations: (): Promise<OperationInfo[]> => ipcRenderer.invoke(IpcChannels.EngineListOperations),

  getOperationDefaults: (
    operationId: string,
    inputs: Record<string, unknown>
  ): Promise<OperationDefaults> => ipcRenderer.invoke(IpcChannels.EngineGetOperationDefaults, { operationId, inputs }),

  fetchMembers: (
    namespace: string,
    provider: Provider
  ): Promise<Member[]> => ipcRenderer.invoke(IpcChannels.EngineFetchMembers, { namespace, provider }),

  getRepoStats: (
    repoPath: string,
    provider: Provider
  ): Promise<RepoStats> => ipcRenderer.invoke(IpcChannels.EngineGetRepoStats, { repoPath, provider }),

  autoLogin: (): ReturnType<IpcApi["autoLogin"]> => ipcRenderer.invoke(IpcChannels.AuthAutoLogin),

  startGitHubOAuth: (): Promise<{
    user_code: string;
    verification_uri: string;
  }> => ipcRenderer.invoke(IpcChannels.OAuthGitHubDeviceStart),

  startGitLabOAuth: (): Promise<void> => ipcRenderer.invoke(IpcChannels.OAuthGitLabStart),

  cancelOAuth: (): Promise<void> => ipcRenderer.invoke(IpcChannels.OAuthCancel),

  onOAuthAuthenticated: (
    callback: (namespaces: Namespace[], provider: Provider) => void
  ): (() => void) => {
    function listener(_event: unknown, namespaces: Namespace[], provider: Provider) {
      callback(namespaces, provider);
    }
    ipcRenderer.on(IpcChannels.OAuthAuthenticated, listener);

    return () => ipcRenderer.removeListener(IpcChannels.OAuthAuthenticated, listener);
  },

  onOAuthError: (callback: (message: string) => void): (() => void) => {
    function listener(_event: unknown, message: string) {
      callback(message);
    }
    ipcRenderer.on(IpcChannels.OAuthError, listener);

    return () => ipcRenderer.removeListener(IpcChannels.OAuthError, listener);
  },

  onOperationsChanged: (
    callback: (ops: OperationInfo[]) => void
  ): (() => void) => {
    function listener(_event: unknown, ops: OperationInfo[]) {
      callback(ops);
    }
    ipcRenderer.on(IpcChannels.RegistryOperationsChanged, listener);

    return () => ipcRenderer.removeListener(IpcChannels.RegistryOperationsChanged, listener);
  },

  loadPlugin: (filePath: string): Promise<PluginInfo> => ipcRenderer.invoke(IpcChannels.PluginLoad, { filePath }),

  pickAndLoadPlugin: (): Promise<PluginInfo | null> => ipcRenderer.invoke(IpcChannels.PluginPickAndLoad),

  getMissingPlugins: (): Promise<string[]> => ipcRenderer.invoke(IpcChannels.PluginGetMissing),

  listPlugins: (): Promise<LoadedPluginInfo[]> => ipcRenderer.invoke(IpcChannels.PluginList),

  unloadPlugin: (filePath: string): Promise<void> => ipcRenderer.invoke(IpcChannels.PluginUnload, { filePath }),

  reloadPlugin: (filePath: string): Promise<PluginInfo> => ipcRenderer.invoke(IpcChannels.PluginReload, { filePath }),

  onPluginsChanged: (
    callback: (plugins: LoadedPluginInfo[]) => void
  ): (() => void) => {
    function listener(_event: unknown, plugins: LoadedPluginInfo[]) {
      callback(plugins);
    }
    ipcRenderer.on(IpcChannels.RegistryPluginsChanged, listener);

    return () => ipcRenderer.removeListener(IpcChannels.RegistryPluginsChanged, listener);
  },

  listFilters: (): Promise<FilterInfo[]> => ipcRenderer.invoke(IpcChannels.EngineListFilters),

  filterRepos: (
    repos: Repo[],
    filterIds: string[],
    provider: Provider
  ): Promise<string[]> => ipcRenderer.invoke(IpcChannels.EngineFilterRepos, { repos, filterIds, provider }),

  onFiltersChanged: (
    callback: (filters: FilterInfo[]) => void
  ): (() => void) => {
    function listener(_event: unknown, filters: FilterInfo[]) {
      callback(filters);
    }
    ipcRenderer.on(IpcChannels.RegistryFiltersChanged, listener);

    return () => ipcRenderer.removeListener(IpcChannels.RegistryFiltersChanged, listener);
  },

  listHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IpcChannels.HistoryList),

  recordRun: (payload: RecordRunPayload): Promise<void> => ipcRenderer.invoke(IpcChannels.HistoryRecord, payload)
});
