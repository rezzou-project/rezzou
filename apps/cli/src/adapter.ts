// Import Third-party Dependencies
import { GitHubAdapter, GitLabAdapter } from "@rezzou/providers";
import type { ProviderAdapter } from "@rezzou/core";

// Import Internal Dependencies
import { loadToken as defaultLoadToken } from "./credentials.ts";

interface CreateAdapterDeps {
  loadToken?: (provider: string) => string | null;
}

export function createAdapter(provider: string, deps: CreateAdapterDeps = {}): ProviderAdapter {
  const { loadToken = defaultLoadToken } = deps;
  const token = loadToken(provider);

  if (token === null) {
    throw new Error(`No credentials found for "${provider}". Run: rezzou login ${provider}`);
  }

  if (provider === "github") {
    return new GitHubAdapter(token);
  }
  if (provider === "gitlab") {
    return new GitLabAdapter(token);
  }

  throw new Error(`Unknown provider: "${provider}". Supported: github, gitlab`);
}
