// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Namespace, ProviderAdapter } from "@rezzou/core";

// Import Internal Dependencies
import { namespacesCommand } from "../commands/namespaces.ts";

// CONSTANTS
const kFakeNamespaces: Namespace[] = [
  { id: "1", name: "myorg", displayName: "My Org", type: "org", provider: "github" },
  { id: "2", name: "testuser", displayName: "Test User", type: "user", provider: "github" }
];

function fakeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    provider: "github",
    listNamespaces: async() => [],
    listRepos: async() => [],
    getFile: async() => null,
    listTree: async() => [],
    branchExists: async() => false,
    submitChanges: async() => {
      return { prUrl: "", prTitle: "" };
    },
    listMembers: async() => [],
    getRepoStats: async() => {
      return { openMRs: 0, openIssues: 0, branches: 0 };
    },
    ...overrides
  };
}

describe("UT namespacesCommand", () => {
  it("should call the adapter factory with the given provider", async() => {
    let calledWith: string | undefined;
    await namespacesCommand(["github"], (provider) => {
      calledWith = provider;

      return fakeAdapter({ listNamespaces: async() => kFakeNamespaces });
    });

    assert.equal(calledWith, "github");
  });

  it("should not call the adapter factory when no provider is given", async() => {
    let called = false;
    await namespacesCommand([], () => {
      called = true;

      return fakeAdapter();
    });

    assert.equal(called, false);
  });

  it("should not call the adapter factory with --help", async() => {
    let called = false;
    await namespacesCommand(["--help"], () => {
      called = true;

      return fakeAdapter();
    });

    assert.equal(called, false);
  });
});
