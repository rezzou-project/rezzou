// Import Node.js Dependencies
import * as crypto from "node:crypto";

// Import Third-party Dependencies
import {
  scanRepos,
  applyRepoDiff,
  type Namespace,
  type Repo,
  type RepoDiff,
  type SubmitResult,
  type ProviderAdapter,
  type OperationDefaults,
  type OperationOverrides,
  type Member,
  type RepoStats
} from "@rezzou/core";

// Import Internal Dependencies
import { providerRegistry } from "./provider-registry.ts";
import { getOperation } from "./operation-registry.ts";

// CONSTANTS
const kGitHubDeviceCodeUrl = "https://github.com/login/device/code";
const kGitHubAccessTokenUrl = "https://github.com/login/oauth/access_token";
const kGitLabAuthorizeUrl = "https://gitlab.com/oauth/authorize";
const kGitLabTokenUrl = "https://gitlab.com/oauth/token";
const kGitLabRedirectUri = "rezzou://gitlab/callback";
const kGitHubScopes = "repo read:org";
const kGitLabScopes = "api read_user";
const kSlowDownIncrement = 5;

export async function handleAuthenticate(
  token: string,
  provider: string
): Promise<{ adapter: ProviderAdapter; namespaces: Namespace[]; }> {
  const descriptor = providerRegistry.get(provider);
  if (!descriptor) {
    throw new Error(`Unknown provider: "${provider}"`);
  }
  const adapter = await Promise.resolve(descriptor.create(token));
  const namespaces = await adapter.listNamespaces();

  return { adapter, namespaces };
}

export async function handleLoadRepos(
  adapter: ProviderAdapter,
  namespace: string
): Promise<Repo[]> {
  return adapter.listRepos(namespace);
}

export interface HandleScanReposOptions {
  operationId: string;
  inputs: Record<string, unknown>;
}

export async function handleScanRepos(
  adapter: ProviderAdapter,
  repos: Repo[],
  options: HandleScanReposOptions
): Promise<RepoDiff[]> {
  const { operationId, inputs } = options;

  return scanRepos(
    adapter,
    repos,
    {
      operation: getOperation(operationId),
      inputs
    }
  );
}

export interface ApplyDiffOptions {
  diff: RepoDiff;
  inputs: Record<string, unknown>;
  operationId: string;
  overrides?: OperationOverrides;
  force?: boolean;
}

export async function handleApplyDiff(
  adapter: ProviderAdapter,
  options: ApplyDiffOptions
): Promise<SubmitResult> {
  const { diff, inputs, operationId, overrides, force } = options;

  return applyRepoDiff(adapter, diff, { operation: getOperation(operationId), inputs, overrides, force });
}

export interface CheckBranchConflictsOptions {
  repoPaths: string[];
  branchName: string;
}

export async function handleCheckBranchConflicts(
  adapter: ProviderAdapter,
  options: CheckBranchConflictsOptions
): Promise<string[]> {
  const { repoPaths, branchName } = options;

  const results = await Promise.all(
    repoPaths.map(async(repoPath) => {
      const exists = await adapter.branchExists(repoPath, branchName);

      return exists ? repoPath : null;
    })
  );

  return results.filter((repoPath): repoPath is string => repoPath !== null);
}

export interface GetOperationDefaultsOptions {
  operationId: string;
  inputs: Record<string, unknown>;
}

export async function handleGetOperationDefaults(options: GetOperationDefaultsOptions): Promise<OperationDefaults> {
  const { operationId, inputs } = options;
  const operation = getOperation(operationId);

  return {
    branchName: await operation.branchName(inputs),
    commitMessage: await operation.commitMessage(inputs),
    prTitle: await operation.prTitle(inputs),
    prDescription: await operation.prDescription(inputs)
  };
}

export async function handleFetchMembers(
  adapter: ProviderAdapter,
  namespace: string
): Promise<Member[]> {
  return adapter.listMembers(namespace);
}

export async function handleGetRepoStats(
  adapter: ProviderAdapter,
  repoPath: string
): Promise<RepoStats> {
  return adapter.getRepoStats(repoPath);
}

export interface GitHubDeviceFlowStart {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

export async function handleGitHubDeviceStart(clientId: string): Promise<GitHubDeviceFlowStart> {
  const response = await fetch(kGitHubDeviceCodeUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope: kGitHubScopes })
  });

  if (!response.ok) {
    throw new Error(`GitHub device code request failed with status ${response.status}`);
  }

  return response.json() as Promise<GitHubDeviceFlowStart>;
}

export interface GitHubDevicePollOptions {
  clientId: string;
  deviceCode: string;
  interval: number;
  signal: AbortSignal;
}

export async function handleGitHubDevicePoll(options: GitHubDevicePollOptions): Promise<string> {
  const { clientId, deviceCode, signal } = options;
  let pollInterval = options.interval;

  while (true) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, pollInterval * 1_000);
      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("OAuth cancelled"));
      }, { once: true });
    });

    const response = await fetch(kGitHubAccessTokenUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      }),
      signal
    });

    const data = await response.json() as Record<string, string>;

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "slow_down") {
      pollInterval += kSlowDownIncrement;
    }
    else if (data.error !== "authorization_pending") {
      throw new Error(data.error_description ?? data.error ?? "Unknown OAuth error");
    }
  }
}

export interface GitLabOAuthStartResult {
  url: string;
  verifier: string;
}

export function handleGitLabOAuthStart(clientId: string): GitLabOAuthStartResult {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  const authUrl = new URL(kGitLabAuthorizeUrl);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", kGitLabRedirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", kGitLabScopes);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return { url: authUrl.toString(), verifier };
}

export async function handleGitLabOAuthCallback(
  clientId: string,
  code: string,
  verifier: string
): Promise<string> {
  const response = await fetch(kGitLabTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      code,
      grant_type: "authorization_code",
      redirect_uri: kGitLabRedirectUri,
      code_verifier: verifier
    })
  });

  if (!response.ok) {
    throw new Error(`GitLab token exchange failed with status ${response.status}`);
  }

  const data = await response.json() as Record<string, string>;
  if (!data.access_token) {
    throw new Error(data.error_description ?? "Failed to obtain access token");
  }

  return data.access_token;
}
