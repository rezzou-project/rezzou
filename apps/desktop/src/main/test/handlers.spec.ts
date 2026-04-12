// Import Node.js Dependencies
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Repo, RepoDiff, SubmitResult } from "@rezzou/core";

// CONSTANTS
const kCurrentYear = String(new Date().getFullYear());
const kToken = "test-token";
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://gitlab.com/ns/my-repo"
};
const kDiff: RepoDiff = {
  repo: kRepo,
  filePath: "LICENSE",
  original: "Copyright 2020",
  updated: `Copyright 2020-${kCurrentYear}`
};
const kSubmitResult: SubmitResult = {
  prUrl: "https://gitlab.com/ns/my-repo/-/merge_requests/1",
  prTitle: "chore: update license year"
};

const mockListRepos = mock.fn(async() => [] as Repo[]);
const mockGetFile = mock.fn(async() => null);
const mockSubmitChanges = mock.fn(async() => kSubmitResult);

mock.module("@rezzou/providers", {
  namedExports: {
    GitLabAdapter: mock.fn(function MockGitLabAdapter() {
      return {
        listRepos: mockListRepos,
        getFile: mockGetFile,
        submitChanges: mockSubmitChanges
      };
    })
  }
});

const mockScanRepos = mock.fn(async(_adapter: unknown, _repos: Repo[], _op: unknown): Promise<RepoDiff[]> => []);
const mockApplyRepoDiff = mock.fn(
  async(_adapter: unknown, _diff: RepoDiff, _op: unknown): Promise<SubmitResult> => kSubmitResult
);

mock.module("@rezzou/core", {
  namedExports: {
    scanRepos: mockScanRepos,
    applyRepoDiff: mockApplyRepoDiff
  }
});

mock.module("@rezzou/operations", {
  namedExports: {
    licenseYearOperation: {
      filePath: "LICENSE",
      branchName: `rezzou/license-year-${kCurrentYear}`,
      commitMessage: `chore: update license year to ${kCurrentYear}`,
      prTitle: `chore: update license year to ${kCurrentYear}`,
      prDescription: "Automated update",
      apply: (content: string) => content
    }
  }
});

const { handleConnect, handleScanRepos, handleApplyDiff } = await import("../handlers.ts");

describe("handleConnect", () => {
  beforeEach(() => {
    mockListRepos.mock.resetCalls();
  });

  it("should call listRepos with the given groupPath and return the result", async() => {
    mockListRepos.mock.mockImplementation(async() => [kRepo]);

    const result = await handleConnect(kToken, "ns");

    assert.equal(mockListRepos.mock.callCount(), 1);
    assert.deepEqual(mockListRepos.mock.calls[0].arguments, ["ns"]);
    assert.deepEqual(result, [kRepo]);
  });

  it("should return an empty array when the group has no repos", async() => {
    mockListRepos.mock.mockImplementation(async() => []);

    const result = await handleConnect(kToken, "empty-ns");

    assert.deepEqual(result, []);
  });
});

describe("handleScanRepos", () => {
  beforeEach(() => {
    mockScanRepos.mock.resetCalls();
  });

  it("should call scanRepos with an adapter built from the token and return the result", async() => {
    const diffs: RepoDiff[] = [kDiff];
    mockScanRepos.mock.mockImplementation(async() => diffs);

    const result = await handleScanRepos(kToken, [kRepo]);

    assert.equal(mockScanRepos.mock.callCount(), 1);
    assert.deepEqual(result, diffs);
  });

  it("should pass the provided repos to scanRepos", async() => {
    mockScanRepos.mock.mockImplementation(async() => []);

    await handleScanRepos(kToken, [kRepo]);

    const [, repos] = mockScanRepos.mock.calls[0].arguments;
    assert.deepEqual(repos, [kRepo]);
  });
});

describe("handleApplyDiff", () => {
  beforeEach(() => {
    mockApplyRepoDiff.mock.resetCalls();
  });

  it("should call applyRepoDiff with an adapter built from the token and return the result", async() => {
    mockApplyRepoDiff.mock.mockImplementation(async() => kSubmitResult);

    const result = await handleApplyDiff(kToken, kDiff);

    assert.equal(mockApplyRepoDiff.mock.callCount(), 1);
    assert.deepEqual(result, kSubmitResult);
  });

  it("should pass the provided diff to applyRepoDiff", async() => {
    mockApplyRepoDiff.mock.mockImplementation(async() => kSubmitResult);

    await handleApplyDiff(kToken, kDiff);

    const [, diff] = mockApplyRepoDiff.mock.calls[0].arguments;
    assert.deepEqual(diff, kDiff);
  });
});
