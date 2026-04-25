// Import Node.js Dependencies
import * as crypto from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MockAgent, fetch as undiciFetch, type MockPool } from "undici";
import type { Repo, RepoDiff, SubmitResult, ProviderAdapter, OperationOverrides, Namespace, Operation } from "@rezzou/core";

// Import Internal Dependencies
import {
  handleAuthenticate,
  handleLoadRepos,
  handleScanRepos,
  handleApplyDiff,
  handleGetOperationDefaults,
  handleGitHubDeviceStart,
  handleGitHubDevicePoll,
  handleGitLabOAuthStart,
  handleGitLabOAuthCallback
} from "../handlers.ts";

// CONSTANTS
const kCurrentYear = String(new Date().getFullYear());
const kToken = "test-token";
const kGitHubOrigin = "https://github.com";
const kGitLabOrigin = "https://gitlab.com";
const kJson = { headers: { "content-type": "application/json" } };
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://gitlab.com/ns/my-repo"
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
const kMockOperation: Operation = {
  id: "license-year",
  name: "License Year",
  description: "Update the copyright year in the LICENSE file",
  apply: async() => null,
  branchName: async() => `rezzou/license-year-${kCurrentYear}`,
  commitMessage: async() => `chore: update license year to ${kCurrentYear}`,
  prTitle: async() => `chore: update license year to ${kCurrentYear}`,
  prDescription: async() => "Automated update"
};

type InterceptOptions = Parameters<MockPool["intercept"]>[0];

function makeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    provider: "gitlab",
    listNamespaces: async() => [],
    listRepos: async() => [],
    getFile: async() => null,
    listTree: async() => [],
    submitChanges: async() => kSubmitResult,
    listMembers: async() => [],
    getRepoStats: async() => {
      return { openMRs: 0, openIssues: 0, branches: 1 };
    },
    branchExists: async() => false,
    ...overrides
  };
}

function createGitHubFetch() {
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  const mockPool = mockAgent.get(kGitHubOrigin);

  function intercept(options: InterceptOptions, status: number, body: unknown) {
    return mockPool.intercept(options).reply(status, body as string | object, kJson);
  }

  function wrappedFetch(url: string | URL | Request, opts?: RequestInit) {
    const init = { ...(opts as Record<string, unknown>), dispatcher: mockAgent };

    return undiciFetch(url as string, init as Parameters<typeof undiciFetch>[1]);
  }

  return { intercept, fetchFn: wrappedFetch as unknown as typeof fetch };
}

function createGitLabFetch() {
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  const mockPool = mockAgent.get(kGitLabOrigin);

  function intercept(options: InterceptOptions, status: number, body: unknown) {
    return mockPool.intercept(options).reply(status, body as string | object, kJson);
  }

  function wrappedFetch(url: string | URL | Request, opts?: RequestInit) {
    const init = { ...(opts as Record<string, unknown>), dispatcher: mockAgent };

    return undiciFetch(url as string, init as Parameters<typeof undiciFetch>[1]);
  }

  return { intercept, fetchFn: wrappedFetch as unknown as typeof fetch };
}

describe("handleAuthenticate", () => {
  it("should call listNamespaces on the created adapter and return the result", async() => {
    const namespaces: Namespace[] = [
      { id: "1", name: "testuser", displayName: "Test User", type: "user", provider: "gitlab" }
    ];
    let listNsCalled = 0;
    const result = await handleAuthenticate(kToken, "gitlab", {
      createAdapter: () => makeAdapter({
        listNamespaces: async() => {
          listNsCalled++;

          return namespaces;
        }
      })
    });

    assert.equal(listNsCalled, 1);
    assert.deepEqual(result.namespaces, namespaces);
    assert.ok(result.adapter !== null);
  });

  it("should pass the token to createAdapter", async() => {
    let capturedToken: string | undefined;
    await handleAuthenticate(kToken, "gitlab", {
      createAdapter: (token) => {
        capturedToken = token;

        return makeAdapter();
      }
    });

    assert.equal(capturedToken, kToken);
  });

  it("should pass the provider to createAdapter", async() => {
    let capturedProvider: string | undefined;
    await handleAuthenticate(kToken, "github", {
      createAdapter: (_token, provider) => {
        capturedProvider = provider;

        return makeAdapter();
      }
    });

    assert.equal(capturedProvider, "github");
  });

  it("should return only the user namespace when no orgs exist", async() => {
    const namespaces: Namespace[] = [
      { id: "solo", name: "solo", displayName: "Solo Dev", type: "user", provider: "gitlab" }
    ];
    const result = await handleAuthenticate(kToken, "gitlab", {
      createAdapter: () => makeAdapter({ listNamespaces: async() => namespaces })
    });

    assert.deepEqual(result.namespaces, namespaces);
  });
});

describe("handleLoadRepos", () => {
  it("should call listRepos with the namespace name and return repos", async() => {
    let calledWith: string | undefined;
    const adapter = makeAdapter({
      listRepos: async(ns) => {
        calledWith = ns;

        return [kRepo];
      }
    });

    const result = await handleLoadRepos(adapter, "ns");

    assert.equal(calledWith, "ns");
    assert.deepEqual(result, [kRepo]);
  });

  it("should return an empty array when the namespace has no repos", async() => {
    const result = await handleLoadRepos(makeAdapter(), "empty-ns");

    assert.deepEqual(result, []);
  });
});

describe("handleScanRepos", () => {
  it("should call scanRepos with the given adapter and return the result", async() => {
    const diffs: RepoDiff[] = [kDiff];
    let scanCalled = 0;

    const result = await handleScanRepos(makeAdapter(), [kRepo], {
      operationId: "license-year",
      inputs: {},
      scanReposFn: async() => {
        scanCalled++;

        return diffs;
      },
      getOperationFn: () => kMockOperation
    });

    assert.equal(scanCalled, 1);
    assert.deepEqual(result, diffs);
  });

  it("should pass the provided repos to scanRepos", async() => {
    let passedRepos: Repo[] | undefined;

    await handleScanRepos(makeAdapter(), [kRepo], {
      operationId: "license-year",
      inputs: {},
      scanReposFn: async(_adapter, repos) => {
        passedRepos = repos;

        return [];
      },
      getOperationFn: () => kMockOperation
    });

    assert.deepEqual(passedRepos, [kRepo]);
  });

  it("should resolve the operation from getOperationFn using operationId", async() => {
    let capturedId: string | undefined;

    await handleScanRepos(makeAdapter(), [kRepo], {
      operationId: "gitignore",
      inputs: {},
      scanReposFn: async() => [],
      getOperationFn: (id) => {
        capturedId = id;

        return kMockOperation;
      }
    });

    assert.equal(capturedId, "gitignore");
  });
});

describe("handleApplyDiff", () => {
  it("should call applyRepoDiff with the given adapter and return the result", async() => {
    let applyCalled = 0;

    const result = await handleApplyDiff(makeAdapter(), { diff: kDiff, inputs: {}, operationId: "license-year" }, {
      applyRepoDiffFn: async() => {
        applyCalled++;

        return kSubmitResult;
      },
      getOperationFn: () => kMockOperation
    });

    assert.equal(applyCalled, 1);
    assert.deepEqual(result, kSubmitResult);
  });

  it("should pass the provided diff to applyRepoDiff", async() => {
    let passedDiff: RepoDiff | undefined;

    await handleApplyDiff(makeAdapter(), { diff: kDiff, inputs: {}, operationId: "license-year" }, {
      applyRepoDiffFn: async(_adapter, diff) => {
        passedDiff = diff;

        return kSubmitResult;
      },
      getOperationFn: () => kMockOperation
    });

    assert.deepEqual(passedDiff, kDiff);
  });

  it("should resolve the operation from getOperationFn using operationId", async() => {
    let capturedId: string | undefined;

    await handleApplyDiff(makeAdapter(), { diff: kDiff, inputs: {}, operationId: "gitignore" }, {
      applyRepoDiffFn: async() => kSubmitResult,
      getOperationFn: (id) => {
        capturedId = id;

        return kMockOperation;
      }
    });

    assert.equal(capturedId, "gitignore");
  });

  it("should pass overrides to applyRepoDiff when provided", async() => {
    let passedOverrides: OperationOverrides | undefined;
    const overrides: OperationOverrides = { branchName: "custom/branch", reviewers: ["alice"] };

    await handleApplyDiff(
      makeAdapter(),
      { diff: kDiff, inputs: {}, operationId: "license-year", overrides },
      {
        applyRepoDiffFn: async(_adapter, _diff, opts) => {
          passedOverrides = opts.overrides;

          return kSubmitResult;
        },
        getOperationFn: () => kMockOperation
      }
    );

    assert.deepEqual(passedOverrides, overrides);
  });
});

describe("handleGetOperationDefaults", () => {
  it("should return computed branch, commit, prTitle and prDescription from the operation", async() => {
    const result = await handleGetOperationDefaults({
      operationId: "license-year",
      inputs: {},
      getOperationFn: () => kMockOperation
    });

    assert.equal(result.branchName, `rezzou/license-year-${kCurrentYear}`);
    assert.equal(result.commitMessage, `chore: update license year to ${kCurrentYear}`);
    assert.equal(result.prTitle, `chore: update license year to ${kCurrentYear}`);
    assert.equal(result.prDescription, "Automated update");
  });

  it("should resolve the operation from getOperationFn using operationId", async() => {
    let capturedId: string | undefined;

    await handleGetOperationDefaults({
      operationId: "gitignore",
      inputs: {},
      getOperationFn: (id) => {
        capturedId = id;

        return kMockOperation;
      }
    });

    assert.equal(capturedId, "gitignore");
  });
});

describe("handleGitLabOAuthStart", () => {
  it("should return a URL with the correct OAuth parameters", () => {
    const { url } = handleGitLabOAuthStart("test-client-id");
    const parsed = new URL(url);

    assert.equal(parsed.origin + parsed.pathname, "https://gitlab.com/oauth/authorize");
    assert.equal(parsed.searchParams.get("client_id"), "test-client-id");
    assert.equal(parsed.searchParams.get("redirect_uri"), "rezzou://gitlab/callback");
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("scope"), "api read_user");
    assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
    assert.ok(parsed.searchParams.get("code_challenge") !== null);
  });

  it("should derive code_challenge from verifier using SHA256 base64url", () => {
    const { url, verifier } = handleGitLabOAuthStart("test-client-id");
    const expectedChallenge = crypto.createHash("sha256").update(verifier).digest("base64url");

    assert.equal(new URL(url).searchParams.get("code_challenge"), expectedChallenge);
  });

  it("should generate a unique verifier on each call", () => {
    const first = handleGitLabOAuthStart("test-client-id");
    const second = handleGitLabOAuthStart("test-client-id");

    assert.notEqual(first.verifier, second.verifier);
  });
});

describe("handleGitHubDeviceStart", () => {
  it("should POST to the device code endpoint and return parsed fields", async() => {
    const kDeviceResponse = {
      device_code: "dev-code-123",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      interval: 5,
      expires_in: 900
    };
    const { intercept, fetchFn } = createGitHubFetch();

    intercept({ method: "POST", path: "/login/device/code" }, 200, kDeviceResponse);

    const result = await handleGitHubDeviceStart("client-id", { fetchFn });

    assert.equal(result.user_code, "ABCD-1234");
    assert.equal(result.verification_uri, "https://github.com/login/device");
    assert.equal(result.device_code, "dev-code-123");
    assert.equal(result.interval, 5);
  });

  it("should throw when the response is not ok", async() => {
    const { intercept, fetchFn } = createGitHubFetch();

    intercept({ method: "POST", path: "/login/device/code" }, 422, { message: "Unprocessable" });

    await assert.rejects(
      handleGitHubDeviceStart("client-id", { fetchFn }),
      /422/
    );
  });
});

describe("handleGitHubDevicePoll", () => {
  it("should return the access token when authorization succeeds", async() => {
    const { intercept, fetchFn } = createGitHubFetch();
    const controller = new AbortController();

    intercept({ method: "POST", path: "/login/oauth/access_token" }, 200, { access_token: "gha_token123" });

    const token = await handleGitHubDevicePoll({
      clientId: "client-id",
      deviceCode: "dev-code",
      interval: 0,
      signal: controller.signal,
      fetchFn
    });

    assert.equal(token, "gha_token123");
  });

  it("should keep polling while authorization is pending", async() => {
    const { intercept, fetchFn } = createGitHubFetch();
    const controller = new AbortController();

    intercept({ method: "POST", path: "/login/oauth/access_token" }, 200, { error: "authorization_pending" });
    intercept({ method: "POST", path: "/login/oauth/access_token" }, 200, { error: "authorization_pending" });
    intercept({ method: "POST", path: "/login/oauth/access_token" }, 200, { access_token: "gha_ready" });

    const token = await handleGitHubDevicePoll({
      clientId: "client-id",
      deviceCode: "dev-code",
      interval: 0,
      signal: controller.signal,
      fetchFn
    });

    assert.equal(token, "gha_ready");
  });

  it("should throw on a terminal error like expired_token", async() => {
    const { intercept, fetchFn } = createGitHubFetch();
    const controller = new AbortController();

    intercept({ method: "POST", path: "/login/oauth/access_token" }, 200, {
      error: "expired_token",
      error_description: "Device code expired"
    });

    await assert.rejects(
      handleGitHubDevicePoll({
        clientId: "client-id",
        deviceCode: "dev-code",
        interval: 0,
        signal: controller.signal,
        fetchFn
      }),
      /Device code expired/
    );
  });
});

describe("handleGitLabOAuthCallback", () => {
  it("should exchange the code for an access token", async() => {
    const { intercept, fetchFn } = createGitLabFetch();

    intercept({ method: "POST", path: "/oauth/token" }, 200, { access_token: "glpat-token" });

    const token = await handleGitLabOAuthCallback({
      clientId: "client-id",
      code: "auth-code",
      verifier: "verifier-123",
      fetchFn
    });

    assert.equal(token, "glpat-token");
  });

  it("should throw when the response is not ok", async() => {
    const { intercept, fetchFn } = createGitLabFetch();

    intercept({ method: "POST", path: "/oauth/token" }, 401, { message: "Unauthorized" });

    await assert.rejects(
      handleGitLabOAuthCallback({
        clientId: "client-id",
        code: "bad-code",
        verifier: "verifier",
        fetchFn
      }),
      /401/
    );
  });

  it("should throw when the response contains no access_token", async() => {
    const { intercept, fetchFn } = createGitLabFetch();

    intercept({ method: "POST", path: "/oauth/token" }, 200, {
      error: "invalid_grant",
      error_description: "Code expired"
    });

    await assert.rejects(
      handleGitLabOAuthCallback({
        clientId: "client-id",
        code: "code",
        verifier: "verifier",
        fetchFn
      }),
      /Code expired/
    );
  });
});
