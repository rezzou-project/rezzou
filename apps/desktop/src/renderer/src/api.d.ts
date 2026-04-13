import type { Repo, RepoDiff, SubmitResult, Provider, Namespace, OperationOverrides, Member } from "@rezzou/core";

declare global {
  interface Window {
    api: {
      authenticate(token: string, provider: Provider): Promise<Namespace[]>;
      loadRepos(namespace: string): Promise<Repo[]>;
      scanRepos(repos: Repo[]): Promise<RepoDiff[]>;
      applyDiff(diff: RepoDiff, overrides: OperationOverrides): Promise<SubmitResult>;
      fetchMembers(namespace: string): Promise<Member[]>;
    };
  }
}
