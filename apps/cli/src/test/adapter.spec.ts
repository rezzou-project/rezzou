// Import Node.js Dependencies
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

// CONSTANTS
const kFakeGitHubAdapter = { provider: "github" };
const kFakeGitLabAdapter = { provider: "gitlab" };

const mockLoadToken = mock.fn((provider: string): string | null => {
  const tokens: Record<string, string> = {
    github: "ghp_token",
    gitlab: "glpat_token",
    bitbucket: "bb_app_password"
  };

  return tokens[provider] ?? null;
});

mock.module("../credentials.ts", {
  namedExports: { loadToken: mockLoadToken }
});

mock.module("@rezzou/providers", {
  namedExports: {
    GitHubAdapter: mock.fn(function MockGitHubAdapter() {
      return kFakeGitHubAdapter;
    }),
    GitLabAdapter: mock.fn(function MockGitLabAdapter() {
      return kFakeGitLabAdapter;
    })
  }
});

const { createAdapter } = await import("../adapter.ts");

describe("UT createAdapter", () => {
  it("should return a GitHubAdapter for 'github'", () => {
    const adapter = createAdapter("github");

    assert.equal(adapter, kFakeGitHubAdapter);
  });

  it("should return a GitLabAdapter for 'gitlab'", () => {
    const adapter = createAdapter("gitlab");

    assert.equal(adapter, kFakeGitLabAdapter);
  });

  it("should throw when no credentials are found for the provider", () => {
    assert.throws(
      () => createAdapter("unknown"),
      { message: /No credentials found/ }
    );
  });

  it("should throw for an unrecognized provider that has a token saved", () => {
    assert.throws(
      () => createAdapter("bitbucket"),
      { message: /Unknown provider/ }
    );
  });
});
