import type { Repo, RepoDiff, SubmitResult, Provider, Namespace, OperationOverrides, Member } from "@rezzou/core";

declare global {
  interface Window {
    api: {
      autoLogin(): Promise<{ namespaces: Namespace[]; provider: Provider; } | null>;
      authenticate(token: string, provider: Provider): Promise<Namespace[]>;
      loadRepos(namespace: string): Promise<Repo[]>;
      scanRepos(repos: Repo[], operationId: string): Promise<RepoDiff[]>;
      applyDiff(diff: RepoDiff, overrides: OperationOverrides, operationId: string): Promise<SubmitResult>;
      listOperations(): Promise<{ id: string; name: string; description: string; filePath: string; }[]>;
      fetchMembers(namespace: string): Promise<Member[]>;
      startGitHubOAuth(): Promise<{ user_code: string; verification_uri: string; }>;
      startGitLabOAuth(): Promise<void>;
      cancelOAuth(): Promise<void>;
      onOAuthAuthenticated(callback: (namespaces: Namespace[], provider: Provider) => void): () => void;
      onOAuthError(callback: (message: string) => void): () => void;
    };
  }
}
