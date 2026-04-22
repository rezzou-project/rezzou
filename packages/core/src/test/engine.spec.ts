
// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { scanRepos, applyRepoDiff } from "../engine.ts";
import type { Repo, Operation, OperationOverrides, RepoDiff, SubmitResult, SubmitParams, RepoContext } from "../types.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

const kOperation: Operation = {
  id: "test-op",
  name: "Test Operation",
  description: "A test operation",
  async apply(ctx: RepoContext) {
    const content = await ctx.readFile("test.txt");
    if (content === null) {
      return null;
    }

    return [{ action: "update", path: "test.txt", content: `${content} updated` }];
  },
  branchName: () => "rezzou/test",
  commitMessage: () => "chore: test",
  prTitle: () => "chore: test",
  prDescription: () => "test description"
};

const kSubmitResult: SubmitResult = {
  prUrl: "https://example.com/mr/1",
  prTitle: "chore: test"
};

type GetFileImpl = (repoPath: string, filePath: string, branch: string) => Promise<{ content: string; ref: string; } | null>;

function makeAdapter(getFileImpl?: GetFileImpl) {
  return {
    provider: "gitlab" as const,
    listNamespaces: async() => [],
    listRepos: async() => [],
    getFile: getFileImpl ?? (async() => null),
    listTree: async() => [],
    submitChanges: async() => kSubmitResult,
    listMembers: async() => []
  };
}

describe("UT scanRepos", () => {
  it("should return empty array when repos list is empty", async() => {
    const result = await scanRepos(makeAdapter(), [], { operation: kOperation, inputs: {} });

    assert.deepEqual(result, []);
  });

  it("should skip repo when getFile returns null", async() => {
    const result = await scanRepos(makeAdapter(), [kRepo], { operation: kOperation, inputs: {} });

    assert.deepEqual(result, []);
  });

  it("should skip repo when apply returns null", async() => {
    const operation: Operation = {
      ...kOperation,
      apply: async() => null
    };

    const result = await scanRepos(makeAdapter(), [kRepo], { operation, inputs: {} });

    assert.deepEqual(result, []);
  });

  it("should return diff when file exists and apply succeeds", async() => {
    const original = "MIT License\nCopyright 2020";
    const adapter = makeAdapter(async() => {
      return { content: original, ref: "main" };
    });

    const result = await scanRepos(adapter, [kRepo], { operation: kOperation, inputs: {} });

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].repo, kRepo);
    assert.deepEqual(result[0].patches, [{ action: "update", path: "test.txt", content: `${original} updated` }]);
    assert.deepEqual(result[0].originals, { "test.txt": original });
  });

  it("should return only diffs for repos with changes", async() => {
    const repoA: Repo = { ...kRepo, id: "1", name: "repo-a", fullPath: "ns/repo-a" };
    const repoB: Repo = { ...kRepo, id: "2", name: "repo-b", fullPath: "ns/repo-b" };
    const repoC: Repo = { ...kRepo, id: "3", name: "repo-c", fullPath: "ns/repo-c" };

    const adapter = makeAdapter(async(repoPath) => {
      if (repoPath === "ns/repo-b") {
        return null;
      }

      return { content: "original content", ref: "main" };
    });

    const result = await scanRepos(adapter, [repoA, repoB, repoC], { operation: kOperation, inputs: {} });

    assert.equal(result.length, 2);
    assert.equal(result[0].repo.fullPath, "ns/repo-a");
    assert.equal(result[1].repo.fullPath, "ns/repo-c");
  });

  it("should call getFile with repo fullPath, operation file path, and defaultBranch", async() => {
    let capturedArgs: [string, string, string] | undefined;

    const adapter = makeAdapter(async(repoPath, filePath, branch) => {
      capturedArgs = [repoPath, filePath, branch];

      return null;
    });

    await scanRepos(adapter, [kRepo], { operation: kOperation, inputs: {} });

    assert.deepEqual(capturedArgs, [kRepo.fullPath, "test.txt", kRepo.defaultBranch]);
  });

  it("should return multi-file diff with all originals when apply returns multiple patches", async() => {
    const fileContents: Record<string, string> = {
      LICENSE: "MIT License\nCopyright 2020",
      "README.md": "# My Repo"
    };

    const multiFileOperation: Operation = {
      ...kOperation,
      async apply(ctx: RepoContext) {
        const license = await ctx.readFile("LICENSE");
        const readme = await ctx.readFile("README.md");
        if (license === null || readme === null) {
          return null;
        }

        return [
          { action: "update", path: "LICENSE", content: `${license} updated` },
          { action: "update", path: "README.md", content: `${readme} updated` }
        ];
      }
    };

    const adapter = makeAdapter(async(_repoPath, filePath) => {
      const content = fileContents[filePath];

      return content ? { content, ref: "main" } : null;
    });

    const result = await scanRepos(adapter, [kRepo], { operation: multiFileOperation, inputs: {} });

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].patches, [
      { action: "update", path: "LICENSE", content: "MIT License\nCopyright 2020 updated" },
      { action: "update", path: "README.md", content: "# My Repo updated" }
    ]);
    assert.deepEqual(result[0].originals, {
      LICENSE: "MIT License\nCopyright 2020",
      "README.md": "# My Repo"
    });
  });
});

describe("UT applyRepoDiff", () => {
  const kDiff: RepoDiff = {
    repo: kRepo,
    patches: [{ action: "update", path: "LICENSE", content: "MIT License\nCopyright 2020-2026" }],
    originals: { LICENSE: "MIT License\nCopyright 2020" }
  };

  function makeSubmitAdapter() {
    let capturedParams: SubmitParams | undefined;
    const adapter = {
      ...makeAdapter(),
      submitChanges: async(params: SubmitParams) => {
        capturedParams = params;

        return kSubmitResult;
      }
    };

    return { adapter, getCaptured: () => capturedParams };
  }

  it("should call submitChanges with correct params and return result", async() => {
    const { adapter, getCaptured } = makeSubmitAdapter();

    const result = await applyRepoDiff(adapter, kDiff, { operation: kOperation, inputs: {} });

    assert.deepEqual(getCaptured(), {
      repoPath: kRepo.fullPath,
      baseBranch: kRepo.defaultBranch,
      headBranch: "rezzou/test",
      commitMessage: "chore: test",
      prTitle: "chore: test",
      prDescription: "test description",
      reviewers: [],
      files: [{ action: "update", path: "LICENSE", content: "MIT License\nCopyright 2020-2026" }],
      force: undefined
    });
    assert.deepEqual(result, kSubmitResult);
  });

  it("should use overrides instead of operation-computed values when provided", async() => {
    const overrides: OperationOverrides = {
      branchName: "custom/branch",
      commitMessage: "custom: commit message",
      prTitle: "Custom PR Title",
      prDescription: "Custom PR description",
      reviewers: ["alice", "bob"]
    };
    const { adapter, getCaptured } = makeSubmitAdapter();

    await applyRepoDiff(adapter, kDiff, { operation: kOperation, inputs: {}, overrides });

    assert.equal(getCaptured()?.headBranch, "custom/branch");
    assert.equal(getCaptured()?.commitMessage, "custom: commit message");
    assert.equal(getCaptured()?.prTitle, "Custom PR Title");
    assert.equal(getCaptured()?.prDescription, "Custom PR description");
    assert.deepEqual(getCaptured()?.reviewers, ["alice", "bob"]);
  });

  it("should fall back to operation-computed values for unset override fields", async() => {
    const overrides: OperationOverrides = { branchName: "custom/branch" };
    const { adapter, getCaptured } = makeSubmitAdapter();

    await applyRepoDiff(adapter, kDiff, { operation: kOperation, inputs: {}, overrides });

    assert.equal(getCaptured()?.headBranch, "custom/branch");
    assert.equal(getCaptured()?.commitMessage, "chore: test");
    assert.deepEqual(getCaptured()?.reviewers, []);
  });

  it("should map multiple patches to CommitAction files", async() => {
    const multiFileDiff: RepoDiff = {
      repo: kRepo,
      patches: [
        { action: "update", path: "LICENSE", content: "MIT License\nCopyright 2020-2026" },
        { action: "update", path: "README.md", content: "# My Repo\nNew content" }
      ],
      originals: {
        LICENSE: "MIT License\nCopyright 2020",
        "README.md": "# My Repo\nOld content"
      }
    };
    const { adapter, getCaptured } = makeSubmitAdapter();

    await applyRepoDiff(adapter, multiFileDiff, { operation: kOperation, inputs: {} });

    assert.deepEqual(getCaptured()?.files, [
      { action: "update", path: "LICENSE", content: "MIT License\nCopyright 2020-2026" },
      { action: "update", path: "README.md", content: "# My Repo\nNew content" }
    ]);
  });
});
