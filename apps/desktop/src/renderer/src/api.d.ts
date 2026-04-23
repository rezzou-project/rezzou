import type { Repo, RepoDiff, SubmitResult, Provider, Namespace, Member, OperationDefaults, OperationOverrides, RepoStats, InputField } from "@rezzou/core";

interface LoadedPluginInfo {
  id: string;
  name: string;
  version: string;
  filePath: string;
  source: "persisted" | "auto-scanned";
}

interface FilterInfo {
  id: string;
  name: string;
  description?: string;
}

declare global {
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

  interface Window {
    api: {
      autoLogin(): Promise<{ namespaces: Namespace[]; provider: Provider; }[] | null>;
      authenticate(token: string, provider: Provider): Promise<Namespace[]>;
      loadRepos(namespace: string, provider: Provider): Promise<Repo[]>;
      scanRepos(repos: Repo[], operationId: string, options: { inputs: Record<string, unknown>; provider: Provider; }): Promise<RepoDiff[]>;
      applyDiff(diff: RepoDiff, options: {
        inputs: Record<string, unknown>;
        operationId: string;
        overrides?: OperationOverrides;
        force?: boolean;
        provider: Provider;
      }): Promise<SubmitResult>;
      checkBranchConflicts(repoPaths: string[], branchName: string, provider: Provider): Promise<string[]>;
      listOperations(): Promise<{ id: string; name: string; description: string; inputs?: readonly InputField[]; }[]>;
      getOperationDefaults(operationId: string, inputs: Record<string, unknown>): Promise<OperationDefaults>;
      fetchMembers(namespace: string, provider: Provider): Promise<Member[]>;
      getRepoStats(repoPath: string, provider: Provider): Promise<RepoStats>;
      startGitHubOAuth(): Promise<{ user_code: string; verification_uri: string; }>;
      startGitLabOAuth(): Promise<void>;
      cancelOAuth(): Promise<void>;
      onOAuthAuthenticated(callback: (namespaces: Namespace[], provider: Provider) => void): () => void;
      onOAuthError(callback: (message: string) => void): () => void;
      onOperationsChanged(callback: (ops: { id: string; name: string; description: string; inputs?: readonly InputField[]; }[]) => void): () => void;
      loadPlugin(filePath: string): Promise<{ id: string; name: string; version: string; }>;
      pickAndLoadPlugin(): Promise<{ id: string; name: string; version: string; } | null>;
      getMissingPlugins(): Promise<string[]>;
      listPlugins(): Promise<LoadedPluginInfo[]>;
      unloadPlugin(filePath: string): Promise<void>;
      reloadPlugin(filePath: string): Promise<{ id: string; name: string; version: string; }>;
      onPluginsChanged(callback: (plugins: LoadedPluginInfo[]) => void): () => void;
      listFilters(): Promise<FilterInfo[]>;
      filterRepos(repos: Repo[], filterIds: string[], provider: Provider): Promise<string[]>;
      onFiltersChanged(callback: (filters: FilterInfo[]) => void): () => void;
      listHistory(): Promise<HistoryEntry[]>;
      recordRun(payload: { operationId: string; namespace: string; results: HistoryEntryResult[] }): Promise<void>;
    };
  }
}
