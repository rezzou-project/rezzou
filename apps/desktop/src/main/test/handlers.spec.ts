// Import Node.js Dependencies
import * as crypto from "node:crypto";
import { describe, it, mock, beforeEach, afterEach } from "node:test";
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

const {
  handleAuthenticate,
  handleLoadRepos,
  handleScanRepos,
  handleApplyDiff,
  handleGitHubDeviceStart,
  handleGitHubDevicePoll,
  handleGitLabOAuthStart,
  handleGitLabOAuthCallback
} = await import("../handlers.ts");

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
  afterEach(() => mock.restoreAll());

  it("should POST to the device code endpoint and return parsed fields", async() => {
    const kDeviceResponse = {
      device_code: "dev-code-123",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      interval: 5,
      expires_in: 900
    };

    mock.method(globalThis, "fetch", async function mockFetch() {
      return {
        ok: true,
        json: async function json() {
          return kDeviceResponse;
        }
      };
    });

    const result = await handleGitHubDeviceStart("client-id");

    assert.equal(result.user_code, "ABCD-1234");
    assert.equal(result.verification_uri, "https://github.com/login/device");
    assert.equal(result.device_code, "dev-code-123");
    assert.equal(result.interval, 5);
  });

  it("should throw when the response is not ok", async() => {
    mock.method(globalThis, "fetch", async function mockFetch() {
      return { ok: false, status: 422 };
    });

    await assert.rejects(
      handleGitHubDeviceStart("client-id"),
      /422/
    );
  });
});

describe("handleGitHubDevicePoll", () => {
  afterEach(() => mock.restoreAll());

  it("should return the access token when authorization succeeds", async() => {
    mock.method(globalThis, "fetch", async function mockFetch() {
      return {
        ok: true,
        json: async function json() {
          return { access_token: "gha_token123" };
        }
      };
    });

    const controller = new AbortController();
    const token = await handleGitHubDevicePoll({
      clientId: "client-id",
      deviceCode: "dev-code",
      interval: 0,
      signal: controller.signal
    });

    assert.equal(token, "gha_token123");
  });

  it("should keep polling while authorization is pending", async() => {
    let callCount = 0;

    mock.method(globalThis, "fetch", async function mockFetch() {
      callCount++;
      const body = callCount < 3
        ? { error: "authorization_pending" }
        : { access_token: "gha_ready" };

      return {
        ok: true,
        json: async function json() {
          return body;
        }
      };
    });

    const controller = new AbortController();
    const token = await handleGitHubDevicePoll({
      clientId: "client-id",
      deviceCode: "dev-code",
      interval: 0,
      signal: controller.signal
    });

    assert.equal(token, "gha_ready");
    assert.equal(callCount, 3);
  });

  it("should throw on a terminal error like expired_token", async() => {
    mock.method(globalThis, "fetch", async function mockFetch() {
      return {
        ok: true,
        json: async function json() {
          return { error: "expired_token", error_description: "Device code expired" };
        }
      };
    });

    const controller = new AbortController();
    await assert.rejects(
      handleGitHubDevicePoll({ clientId: "client-id", deviceCode: "dev-code", interval: 0, signal: controller.signal }),
      /Device code expired/
    );
  });
});

describe("handleGitLabOAuthCallback", () => {
  afterEach(() => mock.restoreAll());

  it("should exchange the code for an access token", async() => {
    mock.method(globalThis, "fetch", async function mockFetch() {
      return {
        ok: true,
        json: async function json() {
          return { access_token: "glpat-token" };
        }
      };
    });

    const token = await handleGitLabOAuthCallback("client-id", "auth-code", "verifier-123");

    assert.equal(token, "glpat-token");
  });

  it("should throw when the response is not ok", async() => {
    mock.method(globalThis, "fetch", async function mockFetch() {
      return { ok: false, status: 401 };
    });

    await assert.rejects(
      handleGitLabOAuthCallback("client-id", "bad-code", "verifier"),
      /401/
    );
  });

  it("should throw when the response contains no access_token", async() => {
    mock.method(globalThis, "fetch", async function mockFetch() {
      return {
        ok: true,
        json: async function json() {
          return { error: "invalid_grant", error_description: "Code expired" };
        }
      };
    });

    await assert.rejects(
      handleGitLabOAuthCallback("client-id", "code", "verifier"),
      /Code expired/
    );
  });
});
