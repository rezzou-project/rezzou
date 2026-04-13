import type { Repo, RepoDiff, SubmitResult, Provider, NamespaceType } from "@rezzou/core";

declare global {
  interface Window {
    api: {
      connect(token: string, groupPath: string, options: { provider: Provider; namespaceType: NamespaceType }): Promise<Repo[]>;
      scanRepos(repos: Repo[]): Promise<RepoDiff[]>;
      applyDiff(diff: RepoDiff): Promise<SubmitResult>;
    };
  }
}
