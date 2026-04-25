/* eslint-disable func-style */
// Import Node.js Dependencies
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Repo, RepoDiff, SubmitResult, Namespace, OperationOverrides } from "@rezzou/core";

// Import Internal Dependencies
import type { IpcApi } from "../../../shared/ipc-channels.ts";

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
const kDefaults = {
  branchName: "rezzou/license-year-2026",
  commitMessage: "chore: update license year to 2026",
  prTitle: "chore: update license year to 2026",
  prDescription: "Automated update"
};

function makeApi(overrides: Partial<IpcApi> = {}): IpcApi {
  return {
    autoLogin: async() => null,
    authenticate: async() => [] as Namespace[],
    loadRepos: async() => [] as Repo[],
    scanRepos: async() => [] as RepoDiff[],
    applyDiff: async() => kSubmitResult,
    checkBranchConflicts: async() => [] as string[],
    listOperations: async() => [],
    getOperationDefaults: async() => kDefaults,
    fetchMembers: async() => [],
    getRepoStats: async() => {
      return { openMRs: 0, openIssues: 0, branches: 1 };
    },
    startGitHubOAuth: async() => {
      return { user_code: "", verification_uri: "" };
    },
    startGitLabOAuth: async() => undefined,
    cancelOAuth: async() => undefined,
    onOAuthAuthenticated: () => () => undefined,
    onOAuthError: () => () => undefined,
    onOperationsChanged: () => () => undefined,
    loadPlugin: async() => {
      return { id: "", name: "", version: "", filePath: "", operations: [], filters: [] };
    },
    pickAndLoadPlugin: async() => null,
    getMissingPlugins: async() => [],
    listPlugins: async() => [],
    unloadPlugin: async() => undefined,
    reloadPlugin: async() => {
      return { id: "", name: "", version: "", filePath: "", operations: [], filters: [] };
    },
    onPluginsChanged: () => () => undefined,
    listFilters: async() => [],
    filterRepos: async() => [],
    onFiltersChanged: () => () => undefined,
    listHistory: async() => [],
    recordRun: async() => undefined,
    listProviders: async() => [],
    onProvidersChanged: () => () => undefined,
    ...overrides
  } as IpcApi;
}

let createStore: typeof import("../stores/app.ts").createStore;
let applyStatus: typeof import("../stores/app.ts").applyStatus;

before(async() => {
  (globalThis as Record<string, unknown>).window = { api: makeApi() };
  const mod = await import("../stores/app.ts");
  createStore = mod.createStore;
  applyStatus = mod.applyStatus;
});

async function setupStore(repos: Repo[] = [kRepo], overrides: Partial<IpcApi> = {}) {
  const store = createStore(makeApi({
    authenticate: async() => [kNamespace],
    loadRepos: async() => repos,
    ...overrides
  }));

  const state = () => store.getState();
  await state().authenticate("token", "gitlab");
  await state().loadRepos(kNamespace);

  return { store, state };
}

describe("authenticate", () => {
  it("should store namespaces and transition to home step on success", async() => {
    const namespaces: Namespace[] = [kNamespace];
    const store = createStore(makeApi({ authenticate: async() => namespaces }));
    const state = () => store.getState();

    await state().authenticate("token", "gitlab");

    const current = state();
    assert.equal(current.step, "home");
    assert.deepEqual(current.connectedProviders.gitlab, namespaces);
    assert.equal(current.isLoading, false);
    assert.equal(current.error, null);
  });

  it("should set error and clear loading on failure", async() => {
    const store = createStore(makeApi({
      authenticate: async() => {
        throw new Error("Unauthorized");
      }
    }));
    const state = () => store.getState();

    await state().authenticate("bad-token", "gitlab");

    const current = state();
    assert.equal(current.step, "connect");
    assert.equal(current.error, "Unauthorized");
    assert.equal(current.isLoading, false);
  });

  it("should call api.authenticate with token and provider", async() => {
    let capturedArgs: unknown;
    const store = createStore(makeApi({
      authenticate: async(token, provider) => {
        capturedArgs = [token, provider];

        return [];
      }
    }));

    await store.getState().authenticate("my-token", "github");

    assert.deepEqual(capturedArgs, ["my-token", "github"]);
  });
});

describe("loadRepos", () => {
  it("should transition to repos step and store repos on success", async() => {
    const { state } = await setupStore([kRepo]);

    const current = state();
    assert.equal(current.step, "repos");
    assert.deepEqual(current.repos, [kRepo]);
    assert.deepEqual(current.selectedRepoIds, [kRepo.id]);
    assert.deepEqual(current.selectedNamespace, kNamespace);
    assert.equal(current.isLoading, false);
    assert.equal(current.error, null);
  });

  it("should select all repos by default after loading", async() => {
    const repoA: Repo = { ...kRepo, id: "1" };
    const repoB: Repo = { ...kRepo, id: "2" };
    const { state } = await setupStore([repoA, repoB]);

    assert.deepEqual(state().selectedRepoIds, ["1", "2"]);
  });

  it("should set error and stay on home step on failure", async() => {
    const store = createStore(makeApi({
      authenticate: async() => [kNamespace],
      loadRepos: async() => {
        throw new Error("Forbidden");
      }
    }));
    const state = () => store.getState();
    await state().authenticate("token", "gitlab");
    await state().loadRepos(kNamespace);

    const current = state();
    assert.equal(current.step, "home");
    assert.equal(current.error, "Forbidden");
    assert.equal(current.isLoading, false);
  });

  it("should call api.loadRepos with namespace name and provider", async() => {
    let capturedArgs: unknown;
    const store = createStore(makeApi({
      authenticate: async() => [kNamespace],
      loadRepos: async(ns, provider) => {
        capturedArgs = [ns, provider];

        return [];
      }
    }));
    const state = () => store.getState();
    await state().authenticate("token", "gitlab");
    await state().loadRepos(kNamespace);

    assert.deepEqual(capturedArgs, [kNamespace.name, kNamespace.provider]);
  });
});

describe("toggleRepo", () => {
  it("should deselect a selected repo", async() => {
    const { state } = await setupStore([kRepo]);

    state().toggleRepo(kRepo.id);

    assert.deepEqual(state().selectedRepoIds, []);
  });

  it("should reselect a deselected repo", async() => {
    const { state } = await setupStore([kRepo]);

    state().toggleRepo(kRepo.id);
    state().toggleRepo(kRepo.id);

    assert.deepEqual(state().selectedRepoIds, [kRepo.id]);
  });
});

describe("selectAll / deselectAll", () => {
  it("should deselect all repos", async() => {
    const { state } = await setupStore([kRepo, { ...kRepo, id: "2" }]);

    state().deselectAll();

    assert.deepEqual(state().selectedRepoIds, []);
  });

  it("should reselect all repos", async() => {
    const repoA: Repo = { ...kRepo, id: "1" };
    const repoB: Repo = { ...kRepo, id: "2" };
    const { state } = await setupStore([repoA, repoB]);

    state().deselectAll();
    state().selectAll();

    assert.deepEqual(state().selectedRepoIds, ["1", "2"]);
  });
});

describe("proceedToPickOperation", () => {
  it("should transition to pick-operation step", async() => {
    const { state } = await setupStore([kRepo]);

    state().proceedToPickOperation();

    assert.equal(state().step, "pick-operation");
  });
});

describe("backToPickOperation", () => {
  async function setupScan() {
    const { state } = await setupStore([kRepo], {
      scanRepos: async() => [kDiff]
    });
    state().proceedToPickOperation();
    state().setSelectedOperation("license-year");
    await state().scanRepos();

    return { state };
  }

  it("should transition back to pick-operation step", async() => {
    const { state } = await setupScan();

    state().backToPickOperation();

    assert.equal(state().step, "pick-operation");
  });

  it("should clear diffs", async() => {
    const { state } = await setupScan();

    state().backToPickOperation();

    assert.deepEqual(state().diffs, []);
  });
});

describe("setSelectedOperation", () => {
  it("should update selectedOperationId", () => {
    const store = createStore(makeApi());
    const state = () => store.getState();

    state().setSelectedOperation("gitignore-maintainer");

    assert.equal(state().selectedOperationId, "gitignore-maintainer");
  });

  it("should default to license-year", () => {
    const store = createStore(makeApi());

    assert.equal(store.getState().selectedOperationId, "license-year");
  });

  it("should not change the current step", () => {
    const store = createStore(makeApi());
    const state = () => store.getState();

    state().setSelectedOperation("gitignore-maintainer");

    assert.equal(state().step, "connect");
  });

  it("should reset operationInputs", () => {
    const store = createStore(makeApi());
    const state = () => store.getState();

    state().setOperationInputs({ year: 2030 });
    state().setSelectedOperation("gitignore-maintainer");

    assert.deepEqual(state().operationInputs, {});
  });

  it("should reset operationOverrides", () => {
    const store = createStore(makeApi());
    const state = () => store.getState();

    state().setOperationOverrides({ branchName: "custom/branch" });
    state().setSelectedOperation("gitignore-maintainer");

    assert.deepEqual(state().operationOverrides, {});
  });
});

describe("setOperationOverrides", () => {
  it("should update operationOverrides", () => {
    const store = createStore(makeApi());
    const state = () => store.getState();
    const overrides: OperationOverrides = { branchName: "custom/branch", reviewers: ["alice"] };

    state().setOperationOverrides(overrides);

    assert.deepEqual(state().operationOverrides, overrides);
  });

  it("should default to empty object", () => {
    const store = createStore(makeApi());

    assert.deepEqual(store.getState().operationOverrides, {});
  });
});

describe("scanRepos", () => {
  it("should transition to diffs step with returned diffs", async() => {
    const { state } = await setupStore([kRepo], { scanRepos: async() => [kDiff] });

    await state().scanRepos();

    const current = state();
    assert.equal(current.step, "diffs");
    assert.equal(current.diffs.length, 1);
    assert.equal(current.diffs[0].applyStatus, applyStatus.Pending);
    assert.equal(current.isLoading, false);
  });

  it("should only pass selected repos to api.scanRepos", async() => {
    const repoA: Repo = { ...kRepo, id: "1" };
    const repoB: Repo = { ...kRepo, id: "2" };
    let passedRepos: Repo[] | undefined;

    const { state } = await setupStore([repoA, repoB], {
      scanRepos: async(repos) => {
        passedRepos = repos;

        return [];
      }
    });
    state().toggleRepo("2");
    await state().scanRepos();

    assert.deepEqual(passedRepos, [repoA]);
  });

  it("should pass selectedOperationId to api.scanRepos", async() => {
    let passedOperationId: string | undefined;

    const { state } = await setupStore([kRepo], {
      scanRepos: async(_repos, operationId) => {
        passedOperationId = operationId;

        return [];
      }
    });
    state().setSelectedOperation("my-op");
    await state().scanRepos();

    assert.equal(passedOperationId, "my-op");
  });

  it("should pass operationInputs to api.scanRepos", async() => {
    let passedInputs: Record<string, unknown> | undefined;

    const { state } = await setupStore([kRepo], {
      scanRepos: async(_repos, _id, options) => {
        passedInputs = options.inputs;

        return [];
      }
    });
    state().setOperationInputs({ year: 2030 });
    await state().scanRepos();

    assert.deepEqual(passedInputs, { year: 2030 });
  });
});

describe("applyDiff", () => {
  async function setupDiffs(overrides: Partial<IpcApi> = {}) {
    const { state } = await setupStore([kRepo], {
      scanRepos: async() => [kDiff],
      ...overrides
    });
    await state().scanRepos();

    return { state };
  }

  it("should set applyStatus to Done and store prUrl on success", async() => {
    const { state } = await setupDiffs({ applyDiff: async() => kSubmitResult });

    await state().applyDiff(kRepo.fullPath);

    const diff = state().diffs[0];
    assert.equal(diff.applyStatus, applyStatus.Done);
    assert.equal(diff.prUrl, kSubmitResult.prUrl);
  });

  it("should set applyStatus to Error and store error message on failure", async() => {
    const { state } = await setupDiffs({
      applyDiff: async() => {
        throw new Error("Rate limit exceeded");
      }
    });

    await state().applyDiff(kRepo.fullPath);

    const diff = state().diffs[0];
    assert.equal(diff.applyStatus, applyStatus.Error);
    assert.equal(diff.error, "Rate limit exceeded");
  });

  it("should do nothing when the diff is not found", async() => {
    let applyCalled = false;
    const { state } = await setupDiffs({
      applyDiff: async() => {
        applyCalled = true;

        return kSubmitResult;
      }
    });

    await state().applyDiff("unknown/repo");

    assert.equal(applyCalled, false);
  });

  it("should pass selectedOperationId to api.applyDiff", async() => {
    let passedOperationId: string | undefined;
    const { state } = await setupDiffs({
      applyDiff: async(_diff, options) => {
        passedOperationId = options.operationId;

        return kSubmitResult;
      }
    });
    state().setSelectedOperation("my-op");

    await state().applyDiff(kRepo.fullPath);

    assert.equal(passedOperationId, "my-op");
  });

  it("should pass operationOverrides to api.applyDiff", async() => {
    let passedOverrides: OperationOverrides | undefined;
    const overrides: OperationOverrides = { branchName: "custom/branch", reviewers: ["alice"] };
    const { state } = await setupDiffs({
      applyDiff: async(_diff, options) => {
        passedOverrides = options.overrides;

        return kSubmitResult;
      }
    });
    state().setOperationOverrides(overrides);

    await state().applyDiff(kRepo.fullPath);

    assert.deepEqual(passedOverrides, overrides);
  });
});

describe("applyAll", () => {
  it("should apply all pending diffs and transition to results step", async() => {
    const repoA: Repo = { ...kRepo, id: "1", fullPath: "ns/repo-a" };
    const repoB: Repo = { ...kRepo, id: "2", fullPath: "ns/repo-b" };
    const diffA: RepoDiff = { ...kDiff, repo: repoA };
    const diffB: RepoDiff = { ...kDiff, repo: repoB };
    let applyCount = 0;

    const { state } = await setupStore([repoA, repoB], {
      scanRepos: async() => [diffA, diffB],
      applyDiff: async() => {
        applyCount++;

        return kSubmitResult;
      }
    });
    await state().scanRepos();
    await state().applyAll();

    assert.equal(applyCount, 2);
    assert.equal(state().step, "results");
  });

  it("should skip diffs that are not pending", async() => {
    let applyCount = 0;
    const { state } = await setupStore([kRepo], {
      scanRepos: async() => [kDiff],
      applyDiff: async() => {
        applyCount++;

        return kSubmitResult;
      }
    });
    await state().scanRepos();
    await state().applyDiff(kRepo.fullPath);
    applyCount = 0;

    await state().applyAll();

    assert.equal(applyCount, 0);
  });
});

describe("openApplyModal", () => {
  async function setupForModal(overrides: Partial<IpcApi> = {}) {
    const { state } = await setupStore([kRepo], {
      scanRepos: async() => [kDiff],
      ...overrides
    });
    await state().scanRepos();

    return { state };
  }

  it("should set applyModalTarget and applyModalRepoPath for single", async() => {
    const { state } = await setupForModal();

    await state().openApplyModal("single", kRepo.fullPath);

    const current = state();
    assert.equal(current.applyModalTarget, "single");
    assert.equal(current.applyModalRepoPath, kRepo.fullPath);
  });

  it("should set applyModalTarget for all", async() => {
    const { state } = await setupForModal();

    await state().openApplyModal("all");

    assert.equal(state().applyModalTarget, "all");
    assert.equal(state().applyModalRepoPath, null);
  });

  it("should pre-fill operationOverrides with computed defaults", async() => {
    const { state } = await setupForModal();

    await state().openApplyModal("single", kRepo.fullPath);

    assert.deepEqual(state().operationOverrides, kDefaults);
  });

  it("should call getOperationDefaults with selectedOperationId and operationInputs", async() => {
    let capturedId: string | undefined;
    let capturedInputs: unknown;

    const { state } = await setupForModal({
      getOperationDefaults: async(id, inputs) => {
        capturedId = id; capturedInputs = inputs;

        return kDefaults;
      }
    });
    state().setSelectedOperation("my-op");
    state().setOperationInputs({ year: 2030 });

    await state().openApplyModal("all");

    assert.equal(capturedId, "my-op");
    assert.deepEqual(capturedInputs, { year: 2030 });
  });
});

describe("closeApplyModal", () => {
  it("should clear applyModalTarget and applyModalRepoPath", async() => {
    const { state } = await setupStore([kRepo], { scanRepos: async() => [kDiff] });
    await state().openApplyModal("single", kRepo.fullPath);

    state().closeApplyModal();

    assert.equal(state().applyModalTarget, null);
    assert.equal(state().applyModalRepoPath, null);
  });
});

describe("confirmApply", () => {
  async function setupForConfirm(overrides: Partial<IpcApi> = {}) {
    const { state } = await setupStore([kRepo], {
      scanRepos: async() => [kDiff],
      applyDiff: async() => kSubmitResult,
      ...overrides
    });
    await state().scanRepos();

    return { state };
  }

  it("should call applyDiff and close modal when target is single", async() => {
    let applyCalled = 0;
    const { state } = await setupForConfirm({
      applyDiff: async() => {
        applyCalled++;

        return kSubmitResult;
      }
    });
    await state().openApplyModal("single", kRepo.fullPath);
    await state().confirmApply();

    assert.equal(applyCalled, 1);
    assert.equal(state().applyModalTarget, null);
  });

  it("should call applyAll and close modal when target is all", async() => {
    let applyCalled = 0;
    const { state } = await setupForConfirm({
      applyDiff: async() => {
        applyCalled++;

        return kSubmitResult;
      }
    });
    await state().openApplyModal("all");
    await state().confirmApply();

    assert.equal(applyCalled, 1);
    assert.equal(state().applyModalTarget, null);
    assert.equal(state().step, "results");
  });

  it("should do nothing when applyModalTarget is null", async() => {
    let applyCalled = 0;
    const { state } = await setupForConfirm({
      applyDiff: async() => {
        applyCalled++;

        return kSubmitResult;
      }
    });

    await state().confirmApply();

    assert.equal(applyCalled, 0);
  });
});

describe("reset", () => {
  it("should restore initial state", async() => {
    const { state } = await setupStore([kRepo]);

    state().reset();

    const current = state();
    assert.equal(current.step, "connect");
    assert.deepEqual(current.repos, []);
    assert.deepEqual(current.connectedProviders, {});
    assert.equal(current.selectedNamespace, null);
    assert.deepEqual(current.selectedRepoIds, []);
    assert.equal(current.error, null);
  });
});
