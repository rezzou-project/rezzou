// Import Third-party Dependencies
import type {
  Repo,
  RepoDiff,
  SubmitResult,
  Provider,
  Namespace,
  Member,
  OperationDefaults,
  OperationOverrides,
  RepoStats,
  InputField
} from "@rezzou/core";

export const IpcChannels = {
  // Auth
  AuthAutoLogin: "auth:auto-login",
  AuthAuthenticate: "auth:authenticate",
  AuthLoadRepos: "auth:loadRepos",
  // OAuth
  OAuthGitHubDeviceStart: "oauth:github-device-start",
  OAuthGitLabStart: "oauth:gitlab-start",
  OAuthCancel: "oauth:cancel",
  OAuthAuthenticated: "oauth:authenticated",
  OAuthError: "oauth:error",
  // Engine
  EngineScanRepos: "engine:scanRepos",
  EngineApplyDiff: "engine:applyDiff",
  EngineCheckBranchConflicts: "engine:checkBranchConflicts",
  EngineListOperations: "engine:listOperations",
  EngineListFilters: "engine:listFilters",
  EngineFilterRepos: "engine:filterRepos",
  EngineGetOperationDefaults: "engine:getOperationDefaults",
  EngineFetchMembers: "engine:fetchMembers",
  EngineGetRepoStats: "engine:getRepoStats",
  // Plugin
  PluginLoad: "plugin:load",
  PluginPickAndLoad: "plugin:pick-and-load",
  PluginGetMissing: "plugin:getMissing",
  PluginList: "plugin:list",
  PluginUnload: "plugin:unload",
  PluginReload: "plugin:reload",
  // History
  HistoryList: "history:list",
  HistoryRecord: "history:record",
  // Registry events (main → renderer)
  RegistryPluginsChanged: "registry:pluginsChanged",
  RegistryOperationsChanged: "registry:operationsChanged",
  RegistryFiltersChanged: "registry:filtersChanged"
} as const;

// IPC handler payload interfaces (main process)

export interface AuthenticateOptions {
  token: string;
  provider: Provider;
}

export interface LoadReposPayload {
  namespace: string;
  provider: Provider;
}

export interface ScanReposPayload {
  repos: Repo[];
  operationId: string;
  inputs: Record<string, unknown>;
  provider: Provider;
}

export interface ApplyDiffPayload {
  diff: RepoDiff;
  inputs: Record<string, unknown>;
  operationId: string;
  overrides?: OperationOverrides;
  force?: boolean;
  provider: Provider;
}

export interface FetchMembersPayload {
  namespace: string;
  provider: Provider;
}

export interface GetRepoStatsPayload {
  repoPath: string;
  provider: Provider;
}

export interface LoadPluginPayload {
  filePath: string;
}

export interface UnloadPluginPayload {
  filePath: string;
}

export interface ReloadPluginPayload {
  filePath: string;
}

export interface FilterReposPayload {
  repos: Repo[];
  filterIds: string[];
  provider: Provider;
}

export interface CheckBranchConflictsPayload {
  repoPaths: string[];
  branchName: string;
  provider: Provider;
}

// Shared domain interfaces (main, preload, renderer)

export interface OperationInfo {
  id: string;
  name: string;
  description: string;
  inputs?: readonly InputField[];
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
}

export interface LoadedPluginInfo {
  id: string;
  name: string;
  version: string;
  filePath: string;
  source: "persisted" | "auto-scanned";
}

export interface FilterInfo {
  id: string;
  name: string;
  description?: string;
}

export interface HistoryEntryResult {
  repoName: string;
  repoFullPath: string;
  status: "done" | "error";
  prUrl?: string;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  operationId: string;
  namespace: string;
  results: HistoryEntryResult[];
}

export interface RecordRunPayload {
  operationId: string;
  namespace: string;
  results: HistoryEntryResult[];
}

// IpcApi — Window.api surface exposed via contextBridge
export interface IpcApi {
  autoLogin(): Promise<{ namespaces: Namespace[]; provider: Provider; }[] | null>;
  authenticate(token: string, provider: Provider): Promise<Namespace[]>;
  loadRepos(namespace: string, provider: Provider): Promise<Repo[]>;
  scanRepos(
    repos: Repo[],
    operationId: string,
    options: { inputs: Record<string, unknown>; provider: Provider; }
  ): Promise<RepoDiff[]>;
  applyDiff(diff: RepoDiff, options: {
    inputs: Record<string, unknown>;
    operationId: string;
    overrides?: OperationOverrides;
    force?: boolean;
    provider: Provider;
  }): Promise<SubmitResult>;
  checkBranchConflicts(repoPaths: string[], branchName: string, provider: Provider): Promise<string[]>;
  listOperations(): Promise<OperationInfo[]>;
  getOperationDefaults(operationId: string, inputs: Record<string, unknown>): Promise<OperationDefaults>;
  fetchMembers(namespace: string, provider: Provider): Promise<Member[]>;
  getRepoStats(repoPath: string, provider: Provider): Promise<RepoStats>;
  startGitHubOAuth(): Promise<{ user_code: string; verification_uri: string; }>;
  startGitLabOAuth(): Promise<void>;
  cancelOAuth(): Promise<void>;
  onOAuthAuthenticated(callback: (namespaces: Namespace[], provider: Provider) => void): () => void;
  onOAuthError(callback: (message: string) => void): () => void;
  onOperationsChanged(callback: (ops: OperationInfo[]) => void): () => void;
  loadPlugin(filePath: string): Promise<PluginInfo>;
  pickAndLoadPlugin(): Promise<PluginInfo | null>;
  getMissingPlugins(): Promise<string[]>;
  listPlugins(): Promise<LoadedPluginInfo[]>;
  unloadPlugin(filePath: string): Promise<void>;
  reloadPlugin(filePath: string): Promise<PluginInfo>;
  onPluginsChanged(callback: (plugins: LoadedPluginInfo[]) => void): () => void;
  listFilters(): Promise<FilterInfo[]>;
  filterRepos(repos: Repo[], filterIds: string[], provider: Provider): Promise<string[]>;
  onFiltersChanged(callback: (filters: FilterInfo[]) => void): () => void;
  listHistory(): Promise<HistoryEntry[]>;
  recordRun(payload: RecordRunPayload): Promise<void>;
}
