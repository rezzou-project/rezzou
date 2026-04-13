
// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { scanRepos, applyRepoDiff } from "../engine.ts";
import type { Repo, Operation, RepoDiff, SubmitResult, SubmitParams } from "../types.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

const kOperation: Operation = {
  filePath: "LICENSE",
  branchName: "rezzou/test",
  commitMessage: "chore: test",
  prTitle: "chore: test",
  prDescription: "test description",
  reviewers: [],
  apply(content: string) {
    return `${content} updated`;
  }
};

const kSubmitResult: SubmitResult = {
  prUrl: "https://example.com/mr/1",
  prTitle: "chore: test"
};

describe("UT scanRepos", () => {
  it("should return empty array when repos list is empty", async() => {
    const adapter = {
      listRepos: async() => [],
      getFile: async() => null,
      submitChanges: async() => kSubmitResult
    };

    const result = await scanRepos(adapter, [], kOperation);

    assert.deepEqual(result, []);
  });

  it("should skip repo when getFile returns null", async() => {
    const adapter = {
      listRepos: async() => [],
      getFile: async() => null,
      submitChanges: async() => kSubmitResult
    };

    const result = await scanRepos(adapter, [kRepo], kOperation);

    assert.deepEqual(result, []);
  });

  it("should skip repo when apply returns null", async() => {
    const adapter = {
      listRepos: async() => [],
      getFile: async() => {
        return { content: "already up to date", ref: "main" };
      },
      submitChanges: async() => kSubmitResult
    };

    const operation: Operation = {
      ...kOperation,
      apply: () => null
    };

    const result = await scanRepos(adapter, [kRepo], operation);

    assert.deepEqual(result, []);
  });

  it("should return diff when file exists and apply succeeds", async() => {
    const original = "MIT License\nCopyright 2020";
    const updated = "MIT License\nCopyright 2020 updated";

    const adapter = {
      listRepos: async() => [],
      getFile: async() => {
        return { content: original, ref: "main" };
      },
      submitChanges: async() => kSubmitResult
    };

    const result = await scanRepos(adapter, [kRepo], kOperation);

    assert.deepEqual(result, [
      {
        repo: kRepo,
        filePath: kOperation.filePath,
        original,
        updated
      }
    ]);
  });

  it("should return only diffs for repos with changes", async() => {
    const repoA: Repo = { ...kRepo, id: "1", name: "repo-a", fullPath: "ns/repo-a" };
    const repoB: Repo = { ...kRepo, id: "2", name: "repo-b", fullPath: "ns/repo-b" };
    const repoC: Repo = { ...kRepo, id: "3", name: "repo-c", fullPath: "ns/repo-c" };

    const adapter = {
      listRepos: async() => [],
      async getFile(repoPath: string) {
        if (repoPath === "ns/repo-b") {
          return null;
        }

        return { content: "original content", ref: "main" };
      },
      submitChanges: async() => kSubmitResult
    };

    const result = await scanRepos(adapter, [repoA, repoB, repoC], kOperation);

    assert.equal(result.length, 2);
    assert.equal(result[0].repo.fullPath, "ns/repo-a");
    assert.equal(result[1].repo.fullPath, "ns/repo-c");
  });

  it("should call getFile with repo fullPath, operation filePath, and defaultBranch", async() => {
    let capturedArgs: [string, string, string] | undefined;

    const adapter = {
      listRepos: async() => [],
      async getFile(repoPath: string, filePath: string, branch: string) {
        capturedArgs = [repoPath, filePath, branch];

        return null;
      },
      submitChanges: async() => kSubmitResult
    };

    await scanRepos(adapter, [kRepo], kOperation);

    assert.deepEqual(capturedArgs, [kRepo.fullPath, kOperation.filePath, kRepo.defaultBranch]);
  });
});

describe("UT applyRepoDiff", () => {
  it("should call submitChanges with correct params and return result", async() => {
    const diff: RepoDiff = {
      repo: kRepo,
      filePath: "LICENSE",
      original: "MIT License\nCopyright 2020",
      updated: "MIT License\nCopyright 2020-2026"
    };

    let capturedParams: SubmitParams | undefined;

    const adapter = {
      listRepos: async() => [],
      getFile: async() => null,
      async submitChanges(params: SubmitParams) {
        capturedParams = params;

        return kSubmitResult;
      }
    };

    const result = await applyRepoDiff(adapter, diff, kOperation);

    assert.deepEqual(capturedParams, {
      repoPath: kRepo.fullPath,
      baseBranch: kRepo.defaultBranch,
      headBranch: kOperation.branchName,
      commitMessage: kOperation.commitMessage,
      prTitle: kOperation.prTitle,
      prDescription: kOperation.prDescription,
      reviewers: [],
      files: [{ action: "update", path: diff.filePath, content: diff.updated }]
    });
    assert.deepEqual(result, kSubmitResult);
  });
});
