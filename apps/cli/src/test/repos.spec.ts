// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Repo, ProviderAdapter } from "@rezzou/core";

// Import Internal Dependencies
import { reposCommand } from "../commands/repos.ts";

// CONSTANTS
const kFakeRepos: Repo[] = [
  {
    id: "1",
    name: "my-project",
    fullPath: "myorg/my-project",
    defaultBranch: "main",
    url: "https://github.com/myorg/my-project"
  },
  {
    id: "2",
    name: "other-project",
    fullPath: "myorg/other-project",
    defaultBranch: "develop",
    url: "https://github.com/myorg/other-project"
  }
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

describe("UT reposCommand", () => {
  it("should call the adapter factory with the given provider", async() => {
    let calledWith: string | undefined;
    await reposCommand(["github", "myorg"], (provider) => {
      calledWith = provider;

      return fakeAdapter({ listRepos: async() => kFakeRepos });
    });

    assert.equal(calledWith, "github");
  });

  it("should call listRepos with the given namespace", async() => {
    let calledNamespace: string | undefined;
    await reposCommand(["github", "myorg"], () => fakeAdapter({
      listRepos: async(namespace) => {
        calledNamespace = namespace;

        return kFakeRepos;
      }
    }));

    assert.equal(calledNamespace, "myorg");
  });

  it("should not call the adapter factory when no provider is given", async() => {
    let called = false;
    await reposCommand([], () => {
      called = true;

      return fakeAdapter();
    });

    assert.equal(called, false);
  });

  it("should not call the adapter factory when namespace is missing", async() => {
    let called = false;
    await reposCommand(["github"], () => {
      called = true;

      return fakeAdapter();
    });

    assert.equal(called, false);
  });

  it("should not call the adapter factory with --help", async() => {
    let called = false;
    await reposCommand(["--help"], () => {
      called = true;

      return fakeAdapter();
    });

    assert.equal(called, false);
  });
});
