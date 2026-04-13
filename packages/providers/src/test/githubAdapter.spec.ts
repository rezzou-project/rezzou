// Import Node.js Dependencies
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// CONSTANTS
const kToken = "test-token";

const mockGetAuthenticated = mock.fn(async() => {
  return { data: { login: "testuser", name: "Test User" } };
});

const mockListForAuthenticatedUser = mock.fn(async() => {
  return { data: [] as unknown[] };
});

const mockListForOrg = mock.fn(async() => {
  return { data: [] as unknown[] };
});

const mockListForUser = mock.fn(async() => {
  return { data: [] as unknown[] };
});

const mockGetContent = mock.fn(async() => {
  return { data: {} as unknown };
});

const mockGetBranch = mock.fn(async() => {
  return { data: { commit: { sha: "base-sha" } } };
});

const mockCreateRef = mock.fn(async() => void 0);
const mockRequest = mock.fn(async() => void 0);

const mockPullsCreate = mock.fn(async() => {
  return { data: { html_url: "", title: "" } };
});

const mockRequestReviewers = mock.fn(async() => void 0);
const mockListOrgMembers = mock.fn(async() => {
  return { data: [] as unknown[] };
});

mock.module("@octokit/rest", {
  namedExports: {
    Octokit: mock.fn(function MockOctokit() {
      return {
        users: {
          getAuthenticated: mockGetAuthenticated
        },
        repos: {
          listForOrg: mockListForOrg,
          listForUser: mockListForUser,
          getContent: mockGetContent,
          getBranch: mockGetBranch
        },
        git: {
          createRef: mockCreateRef
        },
        request: mockRequest,
        pulls: {
          create: mockPullsCreate,
          requestReviewers: mockRequestReviewers
        },
        orgs: {
          listForAuthenticatedUser: mockListForAuthenticatedUser,
          listMembers: mockListOrgMembers
        }
      };
    })
  }
});

const { GitHubAdapter } = await import("../github.ts");

async function setupOrgAdapter(org: string, user = "testuser") {
  mockGetAuthenticated.mock.mockImplementationOnce(async() => {
    return { data: { login: user, name: user } };
  });
  mockListForAuthenticatedUser.mock.mockImplementationOnce(async() => {
    return { data: [{ login: org }] };
  });

  const adapter = new GitHubAdapter(kToken);
  await adapter.listNamespaces();

  return adapter;
}

async function setupUserAdapter(login: string) {
  mockGetAuthenticated.mock.mockImplementationOnce(async() => {
    return { data: { login, name: login } };
  });
  mockListForAuthenticatedUser.mock.mockImplementationOnce(async() => {
    return { data: [] };
  });

  const adapter = new GitHubAdapter(kToken);
  await adapter.listNamespaces();

  return adapter;
}

describe("GitHubAdapter", () => {
  beforeEach(() => {
    mockGetAuthenticated.mock.resetCalls();
    mockListForAuthenticatedUser.mock.resetCalls();
    mockListForOrg.mock.resetCalls();
    mockListForUser.mock.resetCalls();
    mockGetContent.mock.resetCalls();
    mockGetBranch.mock.resetCalls();
    mockCreateRef.mock.resetCalls();
    mockRequest.mock.resetCalls();
    mockPullsCreate.mock.resetCalls();
    mockRequestReviewers.mock.resetCalls();
    mockListOrgMembers.mock.resetCalls();
  });

  describe("listNamespaces", () => {
    it("should return the authenticated user as a user namespace", async() => {
      mockGetAuthenticated.mock.mockImplementation(async() => {
        return { data: { login: "john", name: "John Doe" } };
      });
      mockListForAuthenticatedUser.mock.mockImplementation(async() => {
        return { data: [] };
      });

      const adapter = new GitHubAdapter(kToken);
      const result = await adapter.listNamespaces();

      assert.equal(result.length, 1);
      assert.deepEqual(result[0], {
        id: "john",
        name: "john",
        displayName: "John Doe",
        type: "user"
      });
    });

    it("should fall back to login for displayName when user.name is null", async() => {
      mockGetAuthenticated.mock.mockImplementation(async() => {
        return { data: { login: "john", name: null as unknown as string } };
      });
      mockListForAuthenticatedUser.mock.mockImplementation(async() => {
        return { data: [] };
      });

      const adapter = new GitHubAdapter(kToken);
      const result = await adapter.listNamespaces();

      assert.equal(result[0].displayName, "john");
    });

    it("should return org namespaces alongside the user namespace", async() => {
      mockGetAuthenticated.mock.mockImplementation(async() => {
        return { data: { login: "john", name: "John" } };
      });
      mockListForAuthenticatedUser.mock.mockImplementation(async() => {
        return { data: [{ login: "my-org" }, { login: "another-org" }] };
      });

      const adapter = new GitHubAdapter(kToken);
      const result = await adapter.listNamespaces();

      assert.equal(result.length, 3);
      assert.equal(result[0].type, "user");
      assert.equal(result[1].type, "org");
      assert.equal(result[1].name, "my-org");
      assert.equal(result[2].type, "org");
      assert.equal(result[2].name, "another-org");
    });

    it("should call listForAuthenticatedUser with pagination options", async() => {
      mockGetAuthenticated.mock.mockImplementation(async() => {
        return { data: { login: "john", name: "John" } };
      });
      mockListForAuthenticatedUser.mock.mockImplementation(async() => {
        return { data: [] };
      });

      const adapter = new GitHubAdapter(kToken);
      await adapter.listNamespaces();

      assert.equal(mockListForAuthenticatedUser.mock.callCount(), 1);
      assert.deepEqual(mockListForAuthenticatedUser.mock.calls[0].arguments, [
        { per_page: 100 }
      ]);
    });
  });

  describe("listRepos", () => {
    it("should map GitHub org repos to Repo objects", async() => {
      mockListForOrg.mock.mockImplementation(async() => {
        return {
          data: [
            {
              id: 42,
              name: "my-repo",
              full_name: "my-org/my-repo",
              default_branch: "main",
              html_url: "https://github.com/my-org/my-repo",
              archived: false
            }
          ]
        };
      });

      const adapter = await setupOrgAdapter("my-org");
      const result = await adapter.listRepos("my-org");

      assert.deepEqual(result, [
        {
          id: "42",
          name: "my-repo",
          fullPath: "my-org/my-repo",
          defaultBranch: "main",
          url: "https://github.com/my-org/my-repo"
        }
      ]);
    });

    it("should filter out archived repos", async() => {
      mockListForOrg.mock.mockImplementation(async() => {
        return {
          data: [
            { id: 1, name: "active", full_name: "org/active", default_branch: "main", html_url: "", archived: false },
            { id: 2, name: "old", full_name: "org/old", default_branch: "main", html_url: "", archived: true }
          ]
        };
      });

      const adapter = await setupOrgAdapter("org");
      const result = await adapter.listRepos("org");

      assert.equal(result.length, 1);
      assert.equal(result[0].name, "active");
    });

    it("should call listForUser when namespace type is user", async() => {
      mockListForUser.mock.mockImplementation(async() => {
        return {
          data: [
            {
              id: 99,
              name: "user-repo",
              full_name: "john/user-repo",
              default_branch: "main",
              html_url: "https://github.com/john/user-repo",
              archived: false
            }
          ]
        };
      });

      const adapter = await setupUserAdapter("john");
      const result = await adapter.listRepos("john");

      assert.equal(mockListForOrg.mock.callCount(), 0);
      assert.equal(result.length, 1);
      assert.equal(result[0].fullPath, "john/user-repo");
    });

    it("should call listForOrg with namespace and pagination options", async() => {
      mockListForOrg.mock.mockImplementation(async() => {
        return { data: [] };
      });

      const adapter = await setupOrgAdapter("my-org");
      await adapter.listRepos("my-org");

      assert.equal(mockListForOrg.mock.callCount(), 1);
      assert.deepEqual(mockListForOrg.mock.calls[0].arguments, [
        { org: "my-org", per_page: 100, type: "all" }
      ]);
    });
  });

  describe("getFile", () => {
    it("should return FileContent with decoded content", async() => {
      const rawContent = "MIT License\nCopyright 2020";
      const encoded = Buffer.from(rawContent).toString("base64");

      mockGetContent.mock.mockImplementation(async() => {
        return {
          data: { type: "file", content: encoded, sha: "abc123" }
        };
      });

      const adapter = new GitHubAdapter(kToken);
      const result = await adapter.getFile("owner/repo", "LICENSE", "main");

      assert.deepEqual(result, { content: rawContent, ref: "main" });
    });

    it("should return null when file is not found", async() => {
      mockGetContent.mock.mockImplementation(async() => {
        throw new Error("404 Not Found");
      });

      const adapter = new GitHubAdapter(kToken);
      const result = await adapter.getFile("owner/repo", "LICENSE", "main");

      assert.equal(result, null);
    });

    it("should return null when path points to a directory", async() => {
      mockGetContent.mock.mockImplementation(async() => {
        return {
          data: [{ type: "file", name: "LICENSE" }]
        };
      });

      const adapter = new GitHubAdapter(kToken);
      const result = await adapter.getFile("owner/repo", "src", "main");

      assert.equal(result, null);
    });

    it("should call getContent with owner, repo, path, and ref", async() => {
      const encoded = Buffer.from("content").toString("base64");
      mockGetContent.mock.mockImplementation(async() => {
        return {
          data: { type: "file", content: encoded, sha: "abc" }
        };
      });

      const adapter = new GitHubAdapter(kToken);
      await adapter.getFile("owner/repo", "LICENSE", "develop");

      assert.equal(mockGetContent.mock.callCount(), 1);
      assert.deepEqual(mockGetContent.mock.calls[0].arguments, [
        { owner: "owner", repo: "repo", path: "LICENSE", ref: "develop" }
      ]);
    });
  });

  describe("submitChanges", () => {
    const kParams = {
      repoPath: "owner/repo",
      baseBranch: "main",
      headBranch: "rezzou/license-year-2026",
      commitMessage: "chore: update license year",
      prTitle: "chore: update license year",
      prDescription: "Automated update",
      files: [{ action: "update" as const, path: "LICENSE", content: "MIT License 2026" }]
    };

    beforeEach(() => {
      mockGetBranch.mock.mockImplementation(async() => {
        return {
          data: { commit: { sha: "base-sha" } }
        };
      });
      mockCreateRef.mock.mockImplementation(async() => undefined);
      mockRequest.mock.mockImplementation(async() => undefined);
      mockPullsCreate.mock.mockImplementation(async() => {
        return {
          data: {
            number: 1,
            html_url: "https://github.com/owner/repo/pull/1",
            title: "chore: update license year"
          }
        };
      });
    });

    it("should return prUrl and prTitle", async() => {
      const adapter = new GitHubAdapter(kToken);
      const result = await adapter.submitChanges(kParams);

      assert.deepEqual(result, {
        prUrl: "https://github.com/owner/repo/pull/1",
        prTitle: "chore: update license year"
      });
    });

    it("should create the head branch from the base branch SHA", async() => {
      const adapter = new GitHubAdapter(kToken);
      await adapter.submitChanges(kParams);

      assert.equal(mockCreateRef.mock.callCount(), 1);
      assert.deepEqual(mockCreateRef.mock.calls[0].arguments, [
        {
          owner: "owner",
          repo: "repo",
          ref: "refs/heads/rezzou/license-year-2026",
          sha: "base-sha"
        }
      ]);
    });

    it("should commit all files in a single signed GraphQL commit", async() => {
      const adapter = new GitHubAdapter(kToken);
      await adapter.submitChanges(kParams);

      assert.equal(mockRequest.mock.callCount(), 1);
      const [endpoint, options] = mockRequest.mock.calls[0].arguments as unknown as [string, Record<string, unknown>];
      assert.equal(endpoint, "POST /graphql");
      assert.deepEqual((options.variables as Record<string, unknown>).input, {
        branch: {
          repositoryNameWithOwner: "owner/repo",
          branchName: "rezzou/license-year-2026"
        },
        message: { headline: "chore: update license year" },
        fileChanges: {
          additions: [
            { path: "LICENSE", contents: Buffer.from("MIT License 2026").toString("base64") }
          ],
          deletions: []
        },
        expectedHeadOid: "base-sha"
      });
    });

    it("should create a PR targeting the base branch", async() => {
      const adapter = new GitHubAdapter(kToken);
      await adapter.submitChanges(kParams);

      assert.equal(mockPullsCreate.mock.callCount(), 1);
      assert.deepEqual(mockPullsCreate.mock.calls[0].arguments, [
        {
          owner: "owner",
          repo: "repo",
          head: "rezzou/license-year-2026",
          base: "main",
          title: "chore: update license year",
          body: "Automated update"
        }
      ]);
    });

    it("should request reviewers when reviewers are provided", async() => {
      const adapter = new GitHubAdapter(kToken);
      await adapter.submitChanges({ ...kParams, reviewers: ["john", "bob"] });

      assert.equal(mockRequestReviewers.mock.callCount(), 1);
      assert.deepEqual(mockRequestReviewers.mock.calls[0].arguments, [
        {
          owner: "owner",
          repo: "repo",
          pull_number: 1,
          reviewers: ["john", "bob"]
        }
      ]);
    });

    it("should not request reviewers when reviewers is empty", async() => {
      const adapter = new GitHubAdapter(kToken);
      await adapter.submitChanges({ ...kParams, reviewers: [] });

      assert.equal(mockRequestReviewers.mock.callCount(), 0);
    });
  });

  describe("listMembers", () => {
    it("should return mapped org members", async() => {
      mockListOrgMembers.mock.mockImplementation(async() => {
        return {
          data: [
            { login: "john", avatar_url: "https://avatars.githubusercontent.com/u/1" },
            { login: "bob", avatar_url: "https://avatars.githubusercontent.com/u/2" }
          ]
        };
      });

      const adapter = await setupOrgAdapter("my-org");
      const result = await adapter.listMembers("my-org");

      assert.deepEqual(result, [
        { username: "john", avatarUrl: "https://avatars.githubusercontent.com/u/1" },
        { username: "bob", avatarUrl: "https://avatars.githubusercontent.com/u/2" }
      ]);
    });

    it("should call listMembers with namespace and pagination options", async() => {
      mockListOrgMembers.mock.mockImplementation(async() => {
        return { data: [] };
      });

      const adapter = await setupOrgAdapter("my-org");
      await adapter.listMembers("my-org");

      assert.equal(mockListOrgMembers.mock.callCount(), 1);
      assert.deepEqual(mockListOrgMembers.mock.calls[0].arguments, [
        { org: "my-org", per_page: 100 }
      ]);
    });

    it("should return empty array for user namespace", async() => {
      const adapter = await setupUserAdapter("john");
      const result = await adapter.listMembers("john");

      assert.deepEqual(result, []);
      assert.equal(mockListOrgMembers.mock.callCount(), 0);
    });
  });
});
