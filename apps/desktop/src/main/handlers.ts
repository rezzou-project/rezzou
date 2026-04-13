// Import Third-party Dependencies
import { GitLabAdapter, GitHubAdapter } from "@rezzou/providers";
import { licenseYearOperation } from "@rezzou/operations";
import {
  scanRepos,
  applyRepoDiff,
  type Provider,
  type Namespace,
  type Repo,
  type RepoDiff,
  type SubmitResult,
  type ProviderAdapter,
  type OperationOverrides,
  type Member
} from "@rezzou/core";

export async function handleAuthenticate(
  token: string,
  provider: Provider
): Promise<{ adapter: ProviderAdapter; namespaces: Namespace[]; }> {
  const adapter = provider === "github"
    ? new GitHubAdapter(token)
    : new GitLabAdapter(token);
  const namespaces = await adapter.listNamespaces();

  return { adapter, namespaces };
}

export async function handleLoadRepos(
  adapter: ProviderAdapter,
  namespace: string
): Promise<Repo[]> {
  return adapter.listRepos(namespace);
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
