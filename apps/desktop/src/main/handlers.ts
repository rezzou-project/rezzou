// Import Third-party Dependencies
import { GitLabAdapter, GitHubAdapter } from "@rezzou/providers";
import { licenseYearOperation } from "@rezzou/operations";
import {
  scanRepos,
  applyRepoDiff,
  type Provider,
  type NamespaceType,
  type Repo,
  type RepoDiff,
  type SubmitResult,
  type ProviderAdapter,
  type OperationOverrides,
  type Member
} from "@rezzou/core";

interface ProviderOptions {
  provider: Provider;
  namespaceType: NamespaceType;
}

export async function handleConnect(
  token: string,
  groupPath: string,
  { provider, namespaceType }: ProviderOptions
): Promise<{ adapter: ProviderAdapter; repos: Repo[]; }> {
  const adapter = provider === "github"
    ? new GitHubAdapter(token, namespaceType)
    : new GitLabAdapter(token);
  const repos = await adapter.listRepos(groupPath);

  return { adapter, repos };
}

export async function handleScanRepos(adapter: ProviderAdapter, repos: Repo[]): Promise<RepoDiff[]> {
  return scanRepos(adapter, repos, licenseYearOperation);
}

export async function handleApplyDiff(
  adapter: ProviderAdapter,
  diff: RepoDiff,
  overrides: OperationOverrides
): Promise<SubmitResult> {
  return applyRepoDiff(adapter, diff, { ...licenseYearOperation, ...overrides });
}

export async function handleFetchMembers(
  adapter: ProviderAdapter,
  namespace: string
): Promise<Member[]> {
  return adapter.listMembers(namespace);
}
