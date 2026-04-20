import type { Repo, RepoDiff, SubmitResult, Provider, Namespace, Member, OperationDefaults, OperationOverrides } from "@rezzou/core";

declare global {
  interface Window {
    api: {
      autoLogin(): Promise<{ namespaces: Namespace[]; provider: Provider; } | null>;
      authenticate(token: string, provider: Provider): Promise<Namespace[]>;
      loadRepos(namespace: string): Promise<Repo[]>;
      scanRepos(repos: Repo[], operationId: string, inputs: Record<string, unknown>): Promise<RepoDiff[]>;
      applyDiff(diff: RepoDiff, options: { inputs: Record<string, unknown>; operationId: string; overrides?: OperationOverrides; }): Promise<SubmitResult>;
      listOperations(): Promise<{ id: string; name: string; description: string; }[]>;
      getOperationDefaults(operationId: string, inputs: Record<string, unknown>): Promise<OperationDefaults>;
      fetchMembers(namespace: string): Promise<Member[]>;
      startGitHubOAuth(): Promise<{ user_code: string; verification_uri: string; }>;
      startGitLabOAuth(): Promise<void>;
      cancelOAuth(): Promise<void>;
      onOAuthAuthenticated(callback: (namespaces: Namespace[], provider: Provider) => void): () => void;
      onOAuthError(callback: (message: string) => void): () => void;
      onOperationsChanged(callback: (ops: { id: string; name: string; description: string; }[]) => void): () => void;
      loadPlugin(filePath: string): Promise<{ id: string; name: string; version: string; }>;
      pickAndLoadPlugin(): Promise<{ id: string; name: string; version: string; } | null>;
    };
  }
}
