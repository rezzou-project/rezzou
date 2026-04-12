// Import Third-party Dependencies
import { GitLabAdapter } from "@rezzou/providers";
import { licenseYearOperation } from "@rezzou/operations";
import {
  scanRepos,
  applyRepoDiff,
  type Repo,
  type RepoDiff,
  type SubmitResult,
  type ProviderAdapter
} from "@rezzou/core";

export async function handleConnect(token: string, groupPath: string): Promise<{ adapter: ProviderAdapter; repos: Repo[]; }> {
  const adapter = new GitLabAdapter(token);
  const repos = await adapter.listRepos(groupPath);

  return { adapter, repos };
}

export async function handleScanRepos(adapter: ProviderAdapter, repos: Repo[]): Promise<RepoDiff[]> {
  return scanRepos(adapter, repos, licenseYearOperation);
}

export async function handleApplyDiff(adapter: ProviderAdapter, diff: RepoDiff): Promise<SubmitResult> {
  return applyRepoDiff(adapter, diff, licenseYearOperation);
}
