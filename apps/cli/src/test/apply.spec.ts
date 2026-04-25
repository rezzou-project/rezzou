// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ProviderAdapter, Repo, RepoDiff, Operation, SubmitResult } from "@rezzou/core";

// Import Internal Dependencies
import { applyCommand, type ApplyDeps } from "../commands/apply.ts";

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

const kFakeDiff: RepoDiff = {
  repo: kFakeRepos[0],
  patches: [{ action: "update", path: "LICENSE", content: "new content" }],
  originals: { LICENSE: "old content" }
};

const kFakeSubmitResult: SubmitResult = {
  prUrl: "https://github.com/myorg/repo-alpha/pull/1",
  prTitle: "Test Operation"
};

function fakeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    provider: "github",
    listNamespaces: async() => [],
    listRepos: async() => kFakeRepos,
    getFile: async() => null,
    listTree: async() => [],
    branchExists: async() => false,
    submitChanges: async() => kFakeSubmitResult,
    listMembers: async() => [],
    getRepoStats: async() => {
      return { openMRs: 0, openIssues: 0, branches: 0 };
    },
    ...overrides
  };
}

function fakeDeps(overrides: Partial<ApplyDeps> = {}): ApplyDeps {
  return {
    createAdapter: () => fakeAdapter(),
    getPluginPaths: () => [],
    loadOperations: async() => new Map([["test-op", kFakeOperation]]),
    runScan: async() => [],
    runApply: async() => kFakeSubmitResult,
    confirmApply: async() => true,
    ...overrides
  };
}

describe("UT applyCommand", () => {
  it("should show usage when no args are given", async() => {
    let adapterCalled = false;
    await applyCommand([], fakeDeps({
      createAdapter: () => {
        adapterCalled = true;

        return fakeAdapter();
      }
    }));

    assert.equal(adapterCalled, false);
  });

  it("should show usage when only provider is given", async() => {
    let adapterCalled = false;
    await applyCommand(["github"], fakeDeps({
      createAdapter: () => {
        adapterCalled = true;

        return fakeAdapter();
      }
    }));

    assert.equal(adapterCalled, false);
  });

  it("should show usage with --help", async() => {
    let adapterCalled = false;
    await applyCommand(["github", "myorg", "--help"], fakeDeps({
      createAdapter: () => {
        adapterCalled = true;

        return fakeAdapter();
      }
    }));

    assert.equal(adapterCalled, false);
  });

  it("should show error when --operation is missing", async() => {
    let runScanCalled = false;
    await applyCommand(["github", "myorg"], fakeDeps({
      runScan: async() => {
        runScanCalled = true;

        return [];
      }
    }));

    assert.equal(runScanCalled, false);
  });

  it("should throw when operation is not found", async() => {
    await assert.rejects(
      () => applyCommand(["github", "myorg", "--operation", "unknown-op"], fakeDeps({
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
    await applyCommand(["gitlab", "mygroup", "--operation", "test-op"], fakeDeps({
      createAdapter: (provider) => {
        calledWith = provider;

        return fakeAdapter();
      }
    }));

    assert.equal(calledWith, "gitlab");
  });

  it("should call listRepos with the given namespace", async() => {
    let calledNamespace: string | undefined;
    await applyCommand(["github", "myorg", "--operation", "test-op"], fakeDeps({
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
    await applyCommand(
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
    await applyCommand(
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
    await applyCommand(["github", "myorg", "--operation", "test-op"], fakeDeps({
      runScan: async(_adapter, _repos, options) => {
        capturedOperation = options.operation;

        return [];
      }
    }));

    assert.equal(capturedOperation?.id, "test-op");
  });

  it("should not call runApply when scan returns no diffs", async() => {
    let runApplyCalled = false;
    await applyCommand(["github", "myorg", "--operation", "test-op", "--yes"], fakeDeps({
      runScan: async() => [],
      runApply: async() => {
        runApplyCalled = true;

        return kFakeSubmitResult;
      }
    }));

    assert.equal(runApplyCalled, false);
  });

  it("should not call runApply without --yes in non-interactive mode", async() => {
    let runApplyCalled = false;
    await applyCommand(
      ["github", "myorg", "--operation", "test-op"],
      fakeDeps({
        runScan: async() => [kFakeDiff],
        runApply: async() => {
          runApplyCalled = true;

          return kFakeSubmitResult;
        }
      })
    );

    assert.equal(runApplyCalled, false);
  });

  it("should call runApply for each diff when --yes is given", async() => {
    const appliedRepos: string[] = [];
    const fakeDiff2: RepoDiff = {
      repo: kFakeRepos[1],
      patches: [{ action: "update", path: "LICENSE", content: "new" }],
      originals: { LICENSE: "old" }
    };

    await applyCommand(
      ["github", "myorg", "--operation", "test-op", "--yes"],
      fakeDeps({
        runScan: async() => [kFakeDiff, fakeDiff2],
        runApply: async(_adapter, diff) => {
          appliedRepos.push(diff.repo.fullPath);

          return kFakeSubmitResult;
        }
      })
    );

    assert.deepEqual(appliedRepos, ["myorg/repo-alpha", "myorg/repo-beta"]);
  });

  it("should pass force flag to runApply when --force is given", async() => {
    let capturedForce: boolean | undefined;
    await applyCommand(
      ["github", "myorg", "--operation", "test-op", "--yes", "--force"],
      fakeDeps({
        runScan: async() => [kFakeDiff],
        runApply: async(_adapter, _diff, options) => {
          capturedForce = options.force;

          return kFakeSubmitResult;
        }
      })
    );

    assert.equal(capturedForce, true);
  });

  it("should continue applying when one diff fails", async() => {
    const appliedRepos: string[] = [];
    const fakeDiff2: RepoDiff = {
      repo: kFakeRepos[1],
      patches: [{ action: "update", path: "LICENSE", content: "new" }],
      originals: { LICENSE: "old" }
    };

    await applyCommand(
      ["github", "myorg", "--operation", "test-op", "--yes"],
      fakeDeps({
        runScan: async() => [kFakeDiff, fakeDiff2],
        runApply: async(_adapter, diff) => {
          if (diff.repo.fullPath === "myorg/repo-alpha") {
            throw new Error("submit failed");
          }
          appliedRepos.push(diff.repo.fullPath);

          return kFakeSubmitResult;
        }
      })
    );

    assert.deepEqual(appliedRepos, ["myorg/repo-beta"]);
  });

  it("should call getPluginPaths to resolve plugin list", async() => {
    let pathsCalled = false;
    await applyCommand(["github", "myorg", "--operation", "test-op"], fakeDeps({
      getPluginPaths: () => {
        pathsCalled = true;

        return [];
      }
    }));

    assert.ok(pathsCalled);
  });
});
