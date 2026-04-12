// Import Node.js Dependencies
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Repo, RepoDiff, SubmitResult } from "@rezzou/core";

// CONSTANTS
const kCurrentYear = String(new Date().getFullYear());
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

const mockApiConnect = mock.fn(async() => [] as Repo[]);
const mockApiScanRepos = mock.fn(async(_repos: Repo[]): Promise<RepoDiff[]> => []);
const mockApiApplyDiff = mock.fn(async() => kSubmitResult);

(globalThis as Record<string, unknown>).window = {
  api: {
    connect: mockApiConnect,
    scanRepos: mockApiScanRepos,
    applyDiff: mockApiApplyDiff
  }
};

const { useAppStore, applyStatus } = await import("../stores/app.ts");

function getState() {
  return useAppStore.getState();
}

beforeEach(() => {
  getState().reset();
  mockApiConnect.mock.resetCalls();
  mockApiScanRepos.mock.resetCalls();
  mockApiApplyDiff.mock.resetCalls();
});

describe("connect", () => {
  it("should transition to repos step and store repos on success", async() => {
    mockApiConnect.mock.mockImplementation(async() => [kRepo]);

    await getState().connect("token", "ns");

    const state = getState();
    assert.equal(state.step, "repos");
    assert.deepEqual(state.repos, [kRepo]);
    assert.deepEqual(state.selectedRepoIds, [kRepo.id]);
    assert.equal(state.isLoading, false);
    assert.equal(state.error, null);
  });

  it("should select all repos by default after connect", async() => {
    const repoA: Repo = { ...kRepo, id: "1" };
    const repoB: Repo = { ...kRepo, id: "2" };
    mockApiConnect.mock.mockImplementation(async() => [repoA, repoB]);

    await getState().connect("token", "ns");

    assert.deepEqual(getState().selectedRepoIds, ["1", "2"]);
  });

  it("should set error and stay on connect step on failure", async() => {
    mockApiConnect.mock.mockImplementation(async() => {
      throw new Error("Unauthorized");
    });

    await getState().connect("bad-token", "ns");

    const state = getState();
    assert.equal(state.step, "connect");
    assert.equal(state.error, "Unauthorized");
    assert.equal(state.isLoading, false);
  });

  it("should call window.api.connect with token and groupPath", async() => {
    mockApiConnect.mock.mockImplementation(async() => []);

    await getState().connect("my-token", "my-org");

    assert.equal(mockApiConnect.mock.callCount(), 1);
    assert.deepEqual(mockApiConnect.mock.calls[0].arguments, ["my-token", "my-org"]);
  });
});

describe("toggleRepo", () => {
  beforeEach(async() => {
    mockApiConnect.mock.mockImplementation(async() => [kRepo]);
    await getState().connect("token", "ns");
  });

  it("should deselect a selected repo", () => {
    getState().toggleRepo(kRepo.id);

    assert.deepEqual(getState().selectedRepoIds, []);
  });

  it("should reselect a deselected repo", () => {
    getState().toggleRepo(kRepo.id);
    getState().toggleRepo(kRepo.id);

    assert.deepEqual(getState().selectedRepoIds, [kRepo.id]);
  });
});

describe("selectAll / deselectAll", () => {
  const repoA: Repo = { ...kRepo, id: "1" };
  const repoB: Repo = { ...kRepo, id: "2" };

  beforeEach(async() => {
    mockApiConnect.mock.mockImplementation(async() => [repoA, repoB]);
    await getState().connect("token", "ns");
  });

  it("should deselect all repos", () => {
    getState().deselectAll();

    assert.deepEqual(getState().selectedRepoIds, []);
  });

  it("should reselect all repos", () => {
    getState().deselectAll();
    getState().selectAll();

    assert.deepEqual(getState().selectedRepoIds, ["1", "2"]);
  });
});

describe("scanRepos", () => {
  beforeEach(async() => {
    mockApiConnect.mock.mockImplementation(async() => [kRepo]);
    await getState().connect("token", "ns");
  });

  it("should transition to diffs step with returned diffs", async() => {
    mockApiScanRepos.mock.mockImplementation(async() => [kDiff]);

    await getState().scanRepos();

    const state = getState();
    assert.equal(state.step, "diffs");
    assert.equal(state.diffs.length, 1);
    assert.equal(state.diffs[0].applyStatus, applyStatus.Pending);
    assert.equal(state.isLoading, false);
  });

  it("should only pass selected repos to window.api.scanRepos", async() => {
    const repoA: Repo = { ...kRepo, id: "1" };
    const repoB: Repo = { ...kRepo, id: "2" };
    mockApiConnect.mock.mockImplementation(async() => [repoA, repoB]);
    await getState().connect("token", "ns");

    getState().toggleRepo("2");
    mockApiScanRepos.mock.mockImplementation(async() => []);

    await getState().scanRepos();

    const [passedRepos] = mockApiScanRepos.mock.calls[0].arguments;
    assert.deepEqual(passedRepos, [repoA]);
  });
});

describe("applyDiff", () => {
  beforeEach(async() => {
    mockApiConnect.mock.mockImplementation(async() => [kRepo]);
    await getState().connect("token", "ns");
    mockApiScanRepos.mock.mockImplementation(async() => [kDiff]);
    await getState().scanRepos();
  });

  it("should set applyStatus to Done and store prUrl on success", async() => {
    mockApiApplyDiff.mock.mockImplementation(async() => kSubmitResult);

    await getState().applyDiff(kRepo.fullPath);

    const diff = getState().diffs[0];
    assert.equal(diff.applyStatus, applyStatus.Done);
    assert.equal(diff.prUrl, kSubmitResult.prUrl);
  });

  it("should set applyStatus to Error and store error message on failure", async() => {
    mockApiApplyDiff.mock.mockImplementation(async() => {
      throw new Error("Rate limit exceeded");
    });

    await getState().applyDiff(kRepo.fullPath);

    const diff = getState().diffs[0];
    assert.equal(diff.applyStatus, applyStatus.Error);
    assert.equal(diff.error, "Rate limit exceeded");
  });

  it("should do nothing when the diff is not found", async() => {
    await getState().applyDiff("unknown/repo");

    assert.equal(mockApiApplyDiff.mock.callCount(), 0);
  });
});

describe("applyAll", () => {
  it("should apply all pending diffs and transition to results step", async() => {
    const repoA: Repo = { ...kRepo, id: "1", fullPath: "ns/repo-a" };
    const repoB: Repo = { ...kRepo, id: "2", fullPath: "ns/repo-b" };
    const diffA: RepoDiff = { ...kDiff, repo: repoA };
    const diffB: RepoDiff = { ...kDiff, repo: repoB };

    mockApiConnect.mock.mockImplementation(async() => [repoA, repoB]);
    await getState().connect("token", "ns");
    mockApiScanRepos.mock.mockImplementation(async() => [diffA, diffB]);
    await getState().scanRepos();
    mockApiApplyDiff.mock.mockImplementation(async() => kSubmitResult);

    await getState().applyAll();

    assert.equal(mockApiApplyDiff.mock.callCount(), 2);
    assert.equal(getState().step, "results");
  });

  it("should skip diffs that are not pending", async() => {
    mockApiConnect.mock.mockImplementation(async() => [kRepo]);
    await getState().connect("token", "ns");
    mockApiScanRepos.mock.mockImplementation(async() => [kDiff]);
    await getState().scanRepos();

    mockApiApplyDiff.mock.mockImplementation(async() => kSubmitResult);
    await getState().applyDiff(kRepo.fullPath);
    mockApiApplyDiff.mock.resetCalls();

    await getState().applyAll();

    assert.equal(mockApiApplyDiff.mock.callCount(), 0);
  });
});

describe("reset", () => {
  it("should restore initial state", async() => {
    mockApiConnect.mock.mockImplementation(async() => [kRepo]);
    await getState().connect("token", "ns");

    getState().reset();

    const state = getState();
    assert.equal(state.step, "connect");
    assert.deepEqual(state.repos, []);
    assert.deepEqual(state.selectedRepoIds, []);
    assert.equal(state.error, null);
  });
});
