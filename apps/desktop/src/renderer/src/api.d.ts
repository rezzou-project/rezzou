import type { Repo, RepoDiff, SubmitResult } from "@rezzou/core";

declare global {
  interface Window {
    api: {
      connect(token: string, groupPath: string): Promise<Repo[]>;
      scanRepos(repos: Repo[]): Promise<RepoDiff[]>;
      applyDiff(diff: RepoDiff): Promise<SubmitResult>;
    };
  }
}
