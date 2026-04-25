// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createAdapter } from "../adapter.ts";

// CONSTANTS
const kFakeTokens: Record<string, string> = {
  github: "ghp_token",
  gitlab: "glpat_token"
};

function fakeLoadToken(provider: string): string | null {
  return kFakeTokens[provider] ?? null;
}

describe("UT createAdapter", () => {
  it("should return a GitHubAdapter for 'github'", () => {
    const adapter = createAdapter("github", { loadToken: fakeLoadToken });

    assert.equal(adapter.provider, "github");
  });

  it("should return a GitLabAdapter for 'gitlab'", () => {
    const adapter = createAdapter("gitlab", { loadToken: fakeLoadToken });

    assert.equal(adapter.provider, "gitlab");
  });

  it("should throw when no credentials are found for the provider", () => {
    assert.throws(
      () => createAdapter("unknown", { loadToken: () => null }),
      { message: /No credentials found/ }
    );
  });

  it("should throw for an unrecognized provider that has a token saved", () => {
    assert.throws(
      () => createAdapter("bitbucket", { loadToken: () => "bb_app_password" }),
      { message: /Unknown provider/ }
    );
  });
});
