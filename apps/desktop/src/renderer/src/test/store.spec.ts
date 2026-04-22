// Import Node.js Dependencies
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Repo, RepoDiff, SubmitResult, Namespace, OperationOverrides } from "@rezzou/core";

// CONSTANTS
const kCurrentYear = String(new Date().getFullYear());
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://gitlab.com/ns/my-repo"
};
const kNamespace: Namespace = {
  id: "ns",
  name: "ns",
  displayName: "My Namespace",
  type: "org",
  provider: "gitlab"
};
const kDiff: RepoDiff = {
  repo: kRepo,
  patches: [{ action: "update", path: "LICENSE", content: `Copyright 2020-${kCurrentYear}` }],
  originals: { LICENSE: "Copyright 2020" }
};
const kSubmitResult: SubmitResult = {
  prUrl: "https://gitlab.com/ns/my-repo/-/merge_requests/1",
  prTitle: "chore: update license year"
};

const mockApiAutoLogin = mock.fn(async() => null as { namespaces: Namespace[]; provider: "gitlab" | "github"; }[] | null);
const mockApiAuthenticate = mock.fn(async() => [kNamespace] as Namespace[]);
const mockApiLoadRepos = mock.fn(async(_namespace: string, _provider: string) => [] as Repo[]);
const mockApiScanRepos = mock.fn(
  async(_repos: Repo[], _operationId: string, _inputs: Record<string, unknown>): Promise<RepoDiff[]> => []
);
const mockApiApplyDiff = mock.fn(
  async(_diff: RepoDiff, _options: { inputs: unknown; operationId: string; overrides?: OperationOverrides; }) => kSubmitResult
);
const mockApiListOperations = mock.fn(
  async() => [{ id: "license-year", name: "License Year", description: "Update copyright year" }]
);
const kDefaults = {
  branchName: "rezzou/license-year-2026",
  commitMessage: "chore: update license year to 2026",
  prTitle: "chore: update license year to 2026",
  prDescription: "Automated update"
};
const mockApiGetOperationDefaults = mock.fn(async() => kDefaults);
const mockApiAddHistoryEntry = mock.fn(async() => undefined);

(globalThis as Record<string, unknown>).window = {
  api: {
    autoLogin: mockApiAutoLogin,
    authenticate: mockApiAuthenticate,
    loadRepos: mockApiLoadRepos,
    scanRepos: mockApiScanRepos,
    applyDiff: mockApiApplyDiff,
    listOperations: mockApiListOperations,
    getOperationDefaults: mockApiGetOperationDefaults,
    addHistoryEntry: mockApiAddHistoryEntry
  }
};

const { useAppStore, applyStatus } = await import("../stores/app.ts");

function getState() {
  return useAppStore.getState();
}

async function setupRepos(repos: Repo[] = [kRepo]): Promise<void> {
  mockApiAuthenticate.mock.mockImplementationOnce(async() => [kNamespace]);
  mockApiLoadRepos.mock.mockImplementationOnce(async() => repos);
  await getState().authenticate("token", "gitlab");
  await getState().loadRepos(kNamespace);
}

beforeEach(() => {
  getState().reset();
  mockApiAutoLogin.mock.resetCalls();
  mockApiAuthenticate.mock.resetCalls();
  mockApiLoadRepos.mock.resetCalls();
  mockApiScanRepos.mock.resetCalls();
  mockApiListOperations.mock.resetCalls();
  mockApiApplyDiff.mock.resetCalls();
  mockApiGetOperationDefaults.mock.resetCalls();
  mockApiAddHistoryEntry.mock.resetCalls();
});

describe("authenticate", () => {
  it("should store namespaces and transition to home step on success", async() => {
    const namespaces: Namespace[] = [kNamespace];
    mockApiAuthenticate.mock.mockImplementation(async() => namespaces);

    await getState().authenticate("token", "gitlab");

    const state = getState();
    assert.equal(state.step, "home");
    assert.deepEqual(state.connectedProviders.gitlab, namespaces);
    assert.equal(state.isLoading, false);
    assert.equal(state.error, null);
  });

  it("should set error and clear loading on failure", async() => {
    mockApiAuthenticate.mock.mockImplementation(async() => {
      throw new Error("Unauthorized");
    });

    await getState().authenticate("bad-token", "gitlab");

    const state = getState();
    assert.equal(state.step, "connect");
    assert.equal(state.error, "Unauthorized");
    assert.equal(state.isLoading, false);
  });

  it("should call window.api.authenticate with token and provider", async() => {
    mockApiAuthenticate.mock.mockImplementation(async() => []);

    await getState().authenticate("my-token", "github");

    assert.equal(mockApiAuthenticate.mock.callCount(), 1);
    assert.deepEqual(mockApiAuthenticate.mock.calls[0].arguments, ["my-token", "github"]);
  });
});

describe("loadRepos", () => {
  beforeEach(async() => {
    mockApiAuthenticate.mock.mockImplementation(async() => [kNamespace]);
    await getState().authenticate("token", "gitlab");
  });

  it("should transition to repos step and store repos on success", async() => {
    mockApiLoadRepos.mock.mockImplementation(async() => [kRepo]);

    await getState().loadRepos(kNamespace);

    const state = getState();
    assert.equal(state.step, "repos");
    assert.deepEqual(state.repos, [kRepo]);
    assert.deepEqual(state.selectedRepoIds, [kRepo.id]);
    assert.deepEqual(state.selectedNamespace, kNamespace);
    assert.equal(state.isLoading, false);
    assert.equal(state.error, null);
  });

  it("should select all repos by default after loading", async() => {
    const repoA: Repo = { ...kRepo, id: "1" };
    const repoB: Repo = { ...kRepo, id: "2" };
    mockApiLoadRepos.mock.mockImplementation(async() => [repoA, repoB]);

    await getState().loadRepos(kNamespace);

    assert.deepEqual(getState().selectedRepoIds, ["1", "2"]);
  });

  it("should set error and stay on home step on failure", async() => {
    mockApiLoadRepos.mock.mockImplementation(async() => {
      throw new Error("Forbidden");
    });

    await getState().loadRepos(kNamespace);

    const state = getState();
    assert.equal(state.step, "home");
    assert.equal(state.error, "Forbidden");
    assert.equal(state.isLoading, false);
  });

  it("should call window.api.loadRepos with namespace name and provider", async() => {
    mockApiLoadRepos.mock.mockImplementation(async() => []);

    await getState().loadRepos(kNamespace);

    assert.equal(mockApiLoadRepos.mock.callCount(), 1);
    assert.deepEqual(mockApiLoadRepos.mock.calls[0].arguments, [kNamespace.name, kNamespace.provider]);
  });
});

describe("toggleRepo", () => {
  beforeEach(async() => {
    await setupRepos([kRepo]);
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
    await setupRepos([repoA, repoB]);
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

describe("proceedToPickOperation", () => {
  beforeEach(async() => {
    await setupRepos([kRepo]);
  });

  it("should transition to pick-operation step", () => {
    getState().proceedToPickOperation();

    assert.equal(getState().step, "pick-operation");
  });
});

describe("backToPickOperation", () => {
  beforeEach(async() => {
    await setupRepos([kRepo]);
    mockApiScanRepos.mock.mockImplementationOnce(async() => [kDiff]);
    getState().proceedToPickOperation();
    getState().setSelectedOperation("license-year");
    await getState().scanRepos();
  });

  it("should transition back to pick-operation step", () => {
    getState().backToPickOperation();

    assert.equal(getState().step, "pick-operation");
  });

  it("should clear diffs", () => {
    getState().backToPickOperation();

    assert.deepEqual(getState().diffs, []);
  });
});

describe("setSelectedOperation", () => {
  it("should update selectedOperationId", () => {
    getState().setSelectedOperation("gitignore-maintainer");

    assert.equal(getState().selectedOperationId, "gitignore-maintainer");
  });

  it("should default to license-year", () => {
    assert.equal(getState().selectedOperationId, "license-year");
  });

  it("should not change the current step", () => {
    getState().setSelectedOperation("gitignore-maintainer");

    assert.equal(getState().step, "connect");
  });

  it("should reset operationInputs", () => {
    getState().setOperationInputs({ year: 2030 });
    getState().setSelectedOperation("gitignore-maintainer");

    assert.deepEqual(getState().operationInputs, {});
  });

  it("should reset operationOverrides", () => {
    getState().setOperationOverrides({ branchName: "custom/branch" });
    getState().setSelectedOperation("gitignore-maintainer");

    assert.deepEqual(getState().operationOverrides, {});
  });
});

describe("setOperationOverrides", () => {
  it("should update operationOverrides", () => {
    const overrides: OperationOverrides = { branchName: "custom/branch", reviewers: ["alice"] };
    getState().setOperationOverrides(overrides);

    assert.deepEqual(getState().operationOverrides, overrides);
  });

  it("should default to empty object", () => {
    assert.deepEqual(getState().operationOverrides, {});
  });
});

describe("scanRepos", () => {
  beforeEach(async() => {
    await setupRepos([kRepo]);
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
    await setupRepos([repoA, repoB]);

    getState().toggleRepo("2");
    mockApiScanRepos.mock.mockImplementation(async() => []);

    await getState().scanRepos();

    const [passedRepos] = mockApiScanRepos.mock.calls[0].arguments;
    assert.deepEqual(passedRepos, [repoA]);
  });

  it("should pass selectedOperationId to window.api.scanRepos", async() => {
    mockApiScanRepos.mock.mockImplementation(async() => []);
    getState().setSelectedOperation("my-op");

    await getState().scanRepos();

    const [, passedOperationId] = mockApiScanRepos.mock.calls[0].arguments;
    assert.equal(passedOperationId, "my-op");
  });

  it("should pass operationInputs to window.api.scanRepos", async() => {
    mockApiScanRepos.mock.mockImplementation(async() => []);
    getState().setOperationInputs({ year: 2030 });

    await getState().scanRepos();

    const [,, passedInputs] = mockApiScanRepos.mock.calls[0].arguments;
    assert.deepEqual(passedInputs, { year: 2030 });
  });
});

describe("applyDiff", () => {
  beforeEach(async() => {
    await setupRepos([kRepo]);
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

  it("should pass selectedOperationId to window.api.applyDiff", async() => {
    mockApiApplyDiff.mock.mockImplementation(async() => kSubmitResult);
    getState().setSelectedOperation("my-op");

    await getState().applyDiff(kRepo.fullPath);

    const [, passedOptions] = mockApiApplyDiff.mock.calls[0].arguments;
    assert.equal(passedOptions.operationId, "my-op");
  });

  it("should pass operationOverrides to window.api.applyDiff", async() => {
    mockApiApplyDiff.mock.mockImplementation(async() => kSubmitResult);
    const overrides: OperationOverrides = { branchName: "custom/branch", reviewers: ["alice"] };
    getState().setOperationOverrides(overrides);

    await getState().applyDiff(kRepo.fullPath);

    const [, passedOptions] = mockApiApplyDiff.mock.calls[0].arguments;
    assert.deepEqual(passedOptions.overrides, overrides);
  });
});

describe("applyAll", () => {
  it("should apply all pending diffs and transition to results step", async() => {
    const repoA: Repo = { ...kRepo, id: "1", fullPath: "ns/repo-a" };
    const repoB: Repo = { ...kRepo, id: "2", fullPath: "ns/repo-b" };
    const diffA: RepoDiff = { ...kDiff, repo: repoA };
    const diffB: RepoDiff = { ...kDiff, repo: repoB };

    await setupRepos([repoA, repoB]);
    mockApiScanRepos.mock.mockImplementation(async() => [diffA, diffB]);
    await getState().scanRepos();
    mockApiApplyDiff.mock.mockImplementation(async() => kSubmitResult);

    await getState().applyAll();

    assert.equal(mockApiApplyDiff.mock.callCount(), 2);
    assert.equal(getState().step, "results");
  });

  it("should skip diffs that are not pending", async() => {
    await setupRepos([kRepo]);
    mockApiScanRepos.mock.mockImplementation(async() => [kDiff]);
    await getState().scanRepos();

    mockApiApplyDiff.mock.mockImplementation(async() => kSubmitResult);
    await getState().applyDiff(kRepo.fullPath);
    mockApiApplyDiff.mock.resetCalls();

    await getState().applyAll();

    assert.equal(mockApiApplyDiff.mock.callCount(), 0);
  });
});

describe("openApplyModal", () => {
  beforeEach(async() => {
    await setupRepos([kRepo]);
    mockApiScanRepos.mock.mockImplementation(async() => [kDiff]);
    await getState().scanRepos();
  });

  it("should set applyModalTarget and applyModalRepoPath for single", async() => {
    await getState().openApplyModal("single", kRepo.fullPath);

    const state = getState();
    assert.equal(state.applyModalTarget, "single");
    assert.equal(state.applyModalRepoPath, kRepo.fullPath);
  });

  it("should set applyModalTarget for all", async() => {
    await getState().openApplyModal("all");

    assert.equal(getState().applyModalTarget, "all");
    assert.equal(getState().applyModalRepoPath, null);
  });

  it("should pre-fill operationOverrides with computed defaults", async() => {
    await getState().openApplyModal("single", kRepo.fullPath);

    assert.deepEqual(getState().operationOverrides, kDefaults);
  });

  it("should call getOperationDefaults with selectedOperationId and operationInputs", async() => {
    getState().setSelectedOperation("my-op");
    getState().setOperationInputs({ year: 2030 });

    await getState().openApplyModal("all");

    const [passedId, passedInputs] = mockApiGetOperationDefaults.mock.calls[0].arguments as any[];
    assert.equal(passedId, "my-op");
    assert.deepEqual(passedInputs, { year: 2030 });
  });
});

describe("closeApplyModal", () => {
  it("should clear applyModalTarget and applyModalRepoPath", async() => {
    await setupRepos([kRepo]);
    await getState().openApplyModal("single", kRepo.fullPath);
    getState().closeApplyModal();

    assert.equal(getState().applyModalTarget, null);
    assert.equal(getState().applyModalRepoPath, null);
  });
});

describe("confirmApply", () => {
  beforeEach(async() => {
    await setupRepos([kRepo]);
    mockApiScanRepos.mock.mockImplementation(async() => [kDiff]);
    await getState().scanRepos();
    mockApiApplyDiff.mock.mockImplementation(async() => kSubmitResult);
  });

  it("should call applyDiff and close modal when target is single", async() => {
    await getState().openApplyModal("single", kRepo.fullPath);
    await getState().confirmApply();

    assert.equal(mockApiApplyDiff.mock.callCount(), 1);
    assert.equal(getState().applyModalTarget, null);
  });

  it("should call applyAll and close modal when target is all", async() => {
    await getState().openApplyModal("all");
    await getState().confirmApply();

    assert.equal(mockApiApplyDiff.mock.callCount(), 1);
    assert.equal(getState().applyModalTarget, null);
    assert.equal(getState().step, "results");
  });

  it("should do nothing when applyModalTarget is null", async() => {
    await getState().confirmApply();

    assert.equal(mockApiApplyDiff.mock.callCount(), 0);
  });
});

describe("reset", () => {
  it("should restore initial state", async() => {
    await setupRepos([kRepo]);

    getState().reset();

    const state = getState();
    assert.equal(state.step, "connect");
    assert.deepEqual(state.repos, []);
    assert.deepEqual(state.connectedProviders, {});
    assert.equal(state.selectedNamespace, null);
    assert.deepEqual(state.selectedRepoIds, []);
    assert.equal(state.error, null);
  });
});
