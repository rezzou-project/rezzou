// Import Third-party Dependencies
import { GitLabAdapter } from "@rezzou/providers";
import { licenseYearOperation } from "@rezzou/operations";
import { scanRepos, applyRepoDiff, type Repo, type RepoDiff, type SubmitResult } from "@rezzou/core";

export async function handleConnect(token: string, groupPath: string): Promise<Repo[]> {
  const adapter = new GitLabAdapter(token);

  return adapter.listRepos(groupPath);
}

export async function handleScanRepos(token: string, repos: Repo[]): Promise<RepoDiff[]> {
  const adapter = new GitLabAdapter(token);

  return scanRepos(adapter, repos, licenseYearOperation);
}

export async function handleApplyDiff(token: string, diff: RepoDiff): Promise<SubmitResult> {
  const adapter = new GitLabAdapter(token);

  return applyRepoDiff(adapter, diff, licenseYearOperation);
}
