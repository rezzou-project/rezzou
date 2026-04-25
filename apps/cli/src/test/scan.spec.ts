// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ProviderAdapter, Repo, RepoDiff, Operation } from "@rezzou/core";

// Import Internal Dependencies
import { scanCommand, type ScanDeps } from "../commands/scan.ts";

// CONSTANTS
const kFakeRepos: Repo[] = [
  {
    id: "1",
    name: "repo-alpha",
    fullPath: "myorg/repo-alpha",
    defaultBranch: "main",
    url: "https://github.com/myorg/repo-alpha"
  },
  {
    id: "2",
    name: "repo-beta",
    fullPath: "myorg/repo-beta",
    defaultBranch: "main",
    url: "https://github.com/myorg/repo-beta"
  }
];

const kFakeOperation: Operation = {
  id: "test-op",
  name: "Test Operation",
  description: "A test operation",
  apply: async() => null,
  branchName: () => "rezzou/test",
  commitMessage: () => "test: apply test operation",
  prTitle: () => "Test Operation",
  prDescription: () => ""
};

function fakeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    provider: "github",
    listNamespaces: async() => [],
    listRepos: async() => kFakeRepos,
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

function fakeDeps(overrides: Partial<ScanDeps> = {}): ScanDeps {
  return {
    createAdapter: () => fakeAdapter(),
    getPluginPaths: () => [],
    loadOperations: async() => new Map([["test-op", kFakeOperation]]),
    runScan: async() => [],
    ...overrides
  };
}

describe("UT scanCommand", () => {
  it("should show usage when no args are given", async() => {
    let adapterCalled = false;
    await scanCommand([], fakeDeps({
      createAdapter: () => {
        adapterCalled = true;

        return fakeAdapter();
      }
    }));

    assert.equal(adapterCalled, false);
  });

  it("should show usage when only provider is given", async() => {
    let adapterCalled = false;
    await scanCommand(["github"], fakeDeps({
      createAdapter: () => {
        adapterCalled = true;

        return fakeAdapter();
      }
    }));

    assert.equal(adapterCalled, false);
  });

  it("should show usage with --help", async() => {
    let adapterCalled = false;
    await scanCommand(["github", "myorg", "--help"], fakeDeps({
      createAdapter: () => {
        adapterCalled = true;

        return fakeAdapter();
      }
    }));

    assert.equal(adapterCalled, false);
  });

  it("should show error when --operation is missing", async() => {
    let runScanCalled = false;
    await scanCommand(["github", "myorg"], fakeDeps({
      runScan: async() => {
        runScanCalled = true;

        return [];
      }
    }));

    assert.equal(runScanCalled, false);
  });

  it("should throw when operation is not found", async() => {
    await assert.rejects(
      () => scanCommand(["github", "myorg", "--operation", "unknown-op"], fakeDeps({
        loadOperations: async() => new Map()
      })),
      (error) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("Operation not found"));

        return true;
      }
    );
  });

  it("should call createAdapter with the given provider", async() => {
    let calledWith: string | undefined;
    await scanCommand(["gitlab", "mygroup", "--operation", "test-op"], fakeDeps({
      createAdapter: (provider) => {
        calledWith = provider;

        return fakeAdapter();
      }
    }));

    assert.equal(calledWith, "gitlab");
  });

  it("should call listRepos with the given namespace", async() => {
    let calledNamespace: string | undefined;
    await scanCommand(["github", "myorg", "--operation", "test-op"], fakeDeps({
      createAdapter: () => fakeAdapter({
        listRepos: async(namespace) => {
          calledNamespace = namespace;

          return kFakeRepos;
        }
      })
    }));

    assert.equal(calledNamespace, "myorg");
  });

  it("should pass parsed inputs to runScan", async() => {
    let capturedInputs: Record<string, unknown> | undefined;
    await scanCommand(
      ["github", "myorg", "--operation", "test-op", "--input", "year=2026", "--input", "branch=main"],
      fakeDeps({
        runScan: async(_adapter, _repos, options) => {
          capturedInputs = options.inputs;

          return [];
        }
      })
    );

    assert.deepEqual(capturedInputs, { year: "2026", branch: "main" });
  });

  it("should filter repos by --repos flag", async() => {
    let capturedRepos: Repo[] | undefined;
    await scanCommand(
      ["github", "myorg", "--operation", "test-op", "--repos", "myorg/repo-alpha"],
      fakeDeps({
        runScan: async(_adapter, repos) => {
          capturedRepos = repos;

          return [];
        }
      })
    );

    assert.equal(capturedRepos?.length, 1);
    assert.equal(capturedRepos?.[0].fullPath, "myorg/repo-alpha");
  });

  it("should pass the loaded operation to runScan", async() => {
    let capturedOperation: Operation | undefined;
    await scanCommand(["github", "myorg", "--operation", "test-op"], fakeDeps({
      runScan: async(_adapter, _repos, options) => {
        capturedOperation = options.operation;

        return [];
      }
    }));

    assert.equal(capturedOperation?.id, "test-op");
  });

  it("should display diffs returned by runScan", async() => {
    const fakeDiff: RepoDiff = {
      repo: kFakeRepos[0],
      patches: [{ action: "update", path: "LICENSE", content: "new content" }],
      originals: { LICENSE: "old content" }
    };

    await scanCommand(["github", "myorg", "--operation", "test-op"], fakeDeps({
      runScan: async() => [fakeDiff]
    }));
  });

  it("should call getPluginPaths to resolve plugin list", async() => {
    let pathsCalled = false;
    await scanCommand(["github", "myorg", "--operation", "test-op"], fakeDeps({
      getPluginPaths: () => {
        pathsCalled = true;

        return [];
      }
    }));

    assert.ok(pathsCalled);
  });
});
