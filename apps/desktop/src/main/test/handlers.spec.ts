// Import Node.js Dependencies
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Repo, RepoDiff, SubmitResult, ProviderAdapter, Namespace, OperationOverrides } from "@rezzou/core";

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
const kOverrides: OperationOverrides = {
  branchName: `rezzou/license-year-${kCurrentYear}`,
  commitMessage: `chore: update license year to ${kCurrentYear}`,
  prTitle: `chore: update license year to ${kCurrentYear}`,
  prDescription: "Automated update",
  reviewers: []
};

const mockListNamespaces = mock.fn(async() => [] as Namespace[]);
const mockListRepos = mock.fn(async() => [] as Repo[]);
const mockGetFile = mock.fn(async() => null);
const mockSubmitChanges = mock.fn(async() => kSubmitResult);
const mockListMembers = mock.fn(async() => []);

mock.module("@rezzou/providers", {
  namedExports: {
    GitLabAdapter: mock.fn(function MockGitLabAdapter() {
      return {
        listNamespaces: mockListNamespaces,
        listRepos: mockListRepos,
        getFile: mockGetFile,
        submitChanges: mockSubmitChanges,
        listMembers: mockListMembers
      };
    }),
    GitHubAdapter: mock.fn(function MockGitHubAdapter() {
      return {
        listNamespaces: mockListNamespaces,
        listRepos: mockListRepos,
        getFile: mockGetFile,
        submitChanges: mockSubmitChanges,
        listMembers: mockListMembers
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

const { handleAuthenticate, handleLoadRepos, handleScanRepos, handleApplyDiff } = await import("../handlers.ts");

const kMockAdapter: ProviderAdapter = {
  listNamespaces: mockListNamespaces,
  listRepos: mockListRepos,
  getFile: mockGetFile,
  submitChanges: mockSubmitChanges,
  listMembers: mockListMembers
};

describe("handleAuthenticate", () => {
  beforeEach(() => {
    mockListNamespaces.mock.resetCalls();
  });

  it("should create a GitLabAdapter and return namespaces for gitlab provider", async() => {
    const namespaces: Namespace[] = [
      { id: "1", name: "testuser", displayName: "Test User", type: "user" }
    ];
    mockListNamespaces.mock.mockImplementation(async() => namespaces);

    const result = await handleAuthenticate(kToken, "gitlab");

    assert.equal(mockListNamespaces.mock.callCount(), 1);
    assert.deepEqual(result.namespaces, namespaces);
    assert.ok(result.adapter !== null);
  });

  it("should create a GitHubAdapter and return namespaces for github provider", async() => {
    const namespaces: Namespace[] = [
      { id: "john", name: "john", displayName: "John", type: "user" },
      { id: "my-org", name: "my-org", displayName: "my-org", type: "org" }
    ];
    mockListNamespaces.mock.mockImplementation(async() => namespaces);

    const result = await handleAuthenticate(kToken, "github");

    assert.equal(mockListNamespaces.mock.callCount(), 1);
    assert.deepEqual(result.namespaces, namespaces);
    assert.ok(result.adapter !== null);
  });

  it("should return only the user namespace when the user has no orgs", async() => {
    const namespaces: Namespace[] = [
      { id: "solo", name: "solo", displayName: "Solo Dev", type: "user" }
    ];
    mockListNamespaces.mock.mockImplementation(async() => namespaces);

    const result = await handleAuthenticate(kToken, "gitlab");

    assert.deepEqual(result.namespaces, namespaces);
  });
});

describe("handleLoadRepos", () => {
  beforeEach(() => {
    mockListRepos.mock.resetCalls();
  });

  it("should call listRepos with the namespace name and return repos", async() => {
    mockListRepos.mock.mockImplementation(async() => [kRepo]);

    const result = await handleLoadRepos(kMockAdapter, "ns");

    assert.equal(mockListRepos.mock.callCount(), 1);
    assert.deepEqual(mockListRepos.mock.calls[0].arguments, ["ns"]);
    assert.deepEqual(result, [kRepo]);
  });

  it("should return an empty array when the namespace has no repos", async() => {
    mockListRepos.mock.mockImplementation(async() => []);

    const result = await handleLoadRepos(kMockAdapter, "empty-ns");

    assert.deepEqual(result, []);
  });
});

describe("handleScanRepos", () => {
  beforeEach(() => {
    mockScanRepos.mock.resetCalls();
  });

  it("should call scanRepos with the given adapter and return the result", async() => {
    const diffs: RepoDiff[] = [kDiff];
    mockScanRepos.mock.mockImplementation(async() => diffs);

    const result = await handleScanRepos(kMockAdapter, [kRepo]);

    assert.equal(mockScanRepos.mock.callCount(), 1);
    assert.deepEqual(result, diffs);
  });

  it("should pass the provided repos to scanRepos", async() => {
    mockScanRepos.mock.mockImplementation(async() => []);

    await handleScanRepos(kMockAdapter, [kRepo]);

    const [, repos] = mockScanRepos.mock.calls[0].arguments;
    assert.deepEqual(repos, [kRepo]);
  });
});

describe("handleApplyDiff", () => {
  beforeEach(() => {
    mockApplyRepoDiff.mock.resetCalls();
  });

  it("should call applyRepoDiff with the given adapter and return the result", async() => {
    mockApplyRepoDiff.mock.mockImplementation(async() => kSubmitResult);

    const result = await handleApplyDiff(kMockAdapter, kDiff, kOverrides);

    assert.equal(mockApplyRepoDiff.mock.callCount(), 1);
    assert.deepEqual(result, kSubmitResult);
  });

  it("should pass the provided diff to applyRepoDiff", async() => {
    mockApplyRepoDiff.mock.mockImplementation(async() => kSubmitResult);

    await handleApplyDiff(kMockAdapter, kDiff, kOverrides);

    const [, diff] = mockApplyRepoDiff.mock.calls[0].arguments;
    assert.deepEqual(diff, kDiff);
  });
});
