// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MockAgent, fetch as undiciFetch, type MockPool } from "undici";

// Import Internal Dependencies
import { GitHubAdapter } from "../github.ts";

// CONSTANTS
const kToken = "test-token";
const kGithubOrigin = "https://api.github.com";
const kJson = { headers: { "content-type": "application/json" } };

type InterceptOptions = Parameters<MockPool["intercept"]>[0];
type InterceptBody = Parameters<ReturnType<MockPool["intercept"]>["reply"]>[1];

function createTestSetup() {
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  const mockPool = mockAgent.get(kGithubOrigin);

  function intercept(options: InterceptOptions, status: number, body: InterceptBody) {
    return mockPool.intercept(options).reply(status, body, kJson);
  }

  function testFetch(url: string | URL | Request, opts?: RequestInit) {
    const init = { ...(opts as Record<string, unknown>), dispatcher: mockAgent };

    return undiciFetch(url as string, init as Parameters<typeof undiciFetch>[1]);
  }

  const adapter = new GitHubAdapter(kToken, { fetch: testFetch as typeof globalThis.fetch });

  return { adapter, intercept };
}

describe("GitHubAdapter", () => {
  describe("listNamespaces", () => {
    it("should return the authenticated user as a user namespace", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: "/user" },
        200,
        { login: "john", name: "John Doe", avatar_url: "https://avatars.githubusercontent.com/u/1" }
      );
      intercept({ method: "GET", path: /^\/user\/orgs/ }, 200, []);

      const result = await adapter.listNamespaces();

      assert.equal(result.length, 1);
      assert.deepEqual(result[0], {
        id: "john",
        name: "john",
        displayName: "John Doe",
        type: "user",
        provider: "github",
        avatarUrl: "https://avatars.githubusercontent.com/u/1"
      });
    });

    it("should fall back to login for displayName when user.name is null", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: "/user" }, 200, { login: "john", name: null, avatar_url: null });
      intercept({ method: "GET", path: /^\/user\/orgs/ }, 200, []);

      const result = await adapter.listNamespaces();

      assert.equal(result[0].displayName, "john");
    });

    it("should return org namespaces alongside the user namespace", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: "/user" }, 200, { login: "john", name: "John", avatar_url: null });
      intercept({ method: "GET", path: /^\/user\/orgs/ }, 200, [
        { login: "my-org", avatar_url: null },
        { login: "another-org", avatar_url: null }
      ]);

      const result = await adapter.listNamespaces();

      assert.equal(result.length, 3);
      assert.equal(result[0].type, "user");
      assert.equal(result[1].type, "org");
      assert.equal(result[1].name, "my-org");
      assert.equal(result[2].type, "org");
      assert.equal(result[2].name, "another-org");
    });

    it("should paginate orgs with per_page=100", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: "/user" }, 200, { login: "john", name: "John", avatar_url: null });
      intercept({ method: "GET", path: /\/user\/orgs.*per_page=100/ }, 200, []);

      const result = await adapter.listNamespaces();

      assert.equal(result.length, 1);
    });

    it("should return all orgs when more than 100 exist", async() => {
      const { adapter, intercept } = createTestSetup();

      const manyOrgs = Array.from({ length: 150 }, (_, index) => {
        return { login: `org-${index}`, avatar_url: null };
      });

      intercept({ method: "GET", path: "/user" }, 200, { login: "john", name: "John", avatar_url: null });
      intercept({ method: "GET", path: /^\/user\/orgs/ }, 200, manyOrgs);

      const result = await adapter.listNamespaces();

      assert.equal(result.length, 151);
    });
  });

  describe("listRepos", () => {
    async function setupOrgAdapter(org: string) {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: "/user" }, 200, { login: "testuser", name: "Test User", avatar_url: null });
      intercept({ method: "GET", path: /^\/user\/orgs/ }, 200, [{ login: org, avatar_url: null }]);

      await adapter.listNamespaces();

      return { adapter, intercept };
    }

    async function setupUserAdapter(login: string) {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: "/user" }, 200, { login, name: login, avatar_url: null });
      intercept({ method: "GET", path: /^\/user\/orgs/ }, 200, []);

      await adapter.listNamespaces();

      return { adapter, intercept };
    }

    it("should map GitHub org repos to Repo objects", async() => {
      const { adapter, intercept } = await setupOrgAdapter("my-org");

      intercept({ method: "GET", path: /^\/orgs\/my-org\/repos/ }, 200, [
        {
          id: 42,
          name: "my-repo",
          full_name: "my-org/my-repo",
          default_branch: "main",
          html_url: "https://github.com/my-org/my-repo",
          archived: false
        }
      ]);

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
      const { adapter, intercept } = await setupOrgAdapter("org");

      intercept({ method: "GET", path: /^\/orgs\/org\/repos/ }, 200, [
        { id: 1, name: "active", full_name: "org/active", default_branch: "main", html_url: "", archived: false },
        { id: 2, name: "old", full_name: "org/old", default_branch: "main", html_url: "", archived: true }
      ]);

      const result = await adapter.listRepos("org");

      assert.equal(result.length, 1);
      assert.equal(result[0].name, "active");
    });

    it("should skip repos with no default_branch", async() => {
      const { adapter, intercept } = await setupOrgAdapter("org");

      intercept({ method: "GET", path: /^\/orgs\/org\/repos/ }, 200, [
        { id: 1, name: "has-branch", full_name: "org/has-branch", default_branch: "main", html_url: "", archived: false },
        { id: 2, name: "no-branch", full_name: "org/no-branch", default_branch: null, html_url: "", archived: false }
      ]);

      const result = await adapter.listRepos("org");

      assert.equal(result.length, 1);
      assert.equal(result[0].name, "has-branch");
    });

    it("should call listForUser when namespace type is user", async() => {
      const { adapter, intercept } = await setupUserAdapter("john");

      intercept({ method: "GET", path: /^\/users\/john\/repos/ }, 200, [
        {
          id: 99,
          name: "user-repo",
          full_name: "john/user-repo",
          default_branch: "main",
          html_url: "https://github.com/john/user-repo",
          archived: false
        }
      ]);

      const result = await adapter.listRepos("john");

      assert.equal(result.length, 1);
      assert.equal(result[0].fullPath, "john/user-repo");
    });

    it("should paginate org repos with per_page=100", async() => {
      const { adapter, intercept } = await setupOrgAdapter("my-org");

      intercept({ method: "GET", path: /\/orgs\/my-org\/repos.*per_page=100/ }, 200, []);

      const result = await adapter.listRepos("my-org");

      assert.deepEqual(result, []);
    });

    it("should return all repos when more than 100 exist", async() => {
      const { adapter, intercept } = await setupOrgAdapter("my-org");

      const manyRepos = Array.from({ length: 150 }, (_, index) => {
        return {
          id: index,
          name: `repo-${index}`,
          full_name: `my-org/repo-${index}`,
          default_branch: "main",
          html_url: `https://github.com/my-org/repo-${index}`,
          archived: false
        };
      });

      intercept({ method: "GET", path: /^\/orgs\/my-org\/repos/ }, 200, manyRepos);

      const result = await adapter.listRepos("my-org");

      assert.equal(result.length, 150);
    });
  });

  describe("getFile", () => {
    it("should return FileContent with decoded content", async() => {
      const { adapter, intercept } = createTestSetup();
      const rawContent = "MIT License\nCopyright 2020";
      const encoded = Buffer.from(rawContent).toString("base64");

      intercept(
        { method: "GET", path: /\/repos\/owner\/repo\/contents\/LICENSE/ },
        200,
        { type: "file", content: encoded, sha: "abc123" }
      );

      const result = await adapter.getFile("owner/repo", "LICENSE", "main");

      assert.deepEqual(result, { content: rawContent, ref: "main" });
    });

    it("should return null when file is not found", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/repos\/owner\/repo\/contents\/LICENSE/ },
        404,
        { message: "Not Found" }
      );

      const result = await adapter.getFile("owner/repo", "LICENSE", "main");

      assert.equal(result, null);
    });

    it("should return null when path points to a directory", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/repos\/owner\/repo\/contents\/src/ },
        200,
        [{ type: "file", name: "index.ts" }]
      );

      const result = await adapter.getFile("owner/repo", "src", "main");

      assert.equal(result, null);
    });

    it("should request the file with the correct branch ref", async() => {
      const { adapter, intercept } = createTestSetup();
      const encoded = Buffer.from("content").toString("base64");

      intercept(
        { method: "GET", path: /LICENSE.*ref=develop/ },
        200,
        { type: "file", content: encoded, sha: "abc" }
      );

      const result = await adapter.getFile("owner/repo", "LICENSE", "develop");

      assert.ok(result !== null);
      assert.equal(result.ref, "develop");
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

    it("should return prUrl and prTitle", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/branches\/main/ },
        200,
        { name: "main", commit: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: /\/git\/refs$/ },
        201,
        { ref: "refs/heads/rezzou/license-year-2026", object: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: "/graphql" },
        200,
        { data: { createCommitOnBranch: { commit: { oid: "new-sha" } } } }
      );
      intercept(
        { method: "POST", path: /\/pulls$/ },
        201,
        { number: 1, html_url: "https://github.com/owner/repo/pull/1", title: "chore: update license year" }
      );

      const result = await adapter.submitChanges(kParams);

      assert.deepEqual(result, {
        prUrl: "https://github.com/owner/repo/pull/1",
        prTitle: "chore: update license year"
      });
    });

    it("should create the head branch from the base branch SHA", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/branches\/main/ },
        200,
        { name: "main", commit: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: /\/git\/refs$/ },
        201,
        { ref: "refs/heads/rezzou/license-year-2026", object: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: "/graphql" },
        200,
        { data: { createCommitOnBranch: { commit: { oid: "new-sha" } } } }
      );
      intercept(
        { method: "POST", path: /\/pulls$/ },
        201,
        { number: 1, html_url: "", title: "" }
      );

      await adapter.submitChanges(kParams);
    });

    it("should request reviewers when reviewers are provided", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/branches\/main/ },
        200,
        { name: "main", commit: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: /\/git\/refs$/ },
        201,
        { ref: "refs/heads/rezzou/license-year-2026", object: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: "/graphql" },
        200,
        { data: { createCommitOnBranch: { commit: { oid: "new-sha" } } } }
      );
      intercept(
        { method: "POST", path: /\/pulls$/ },
        201,
        { number: 1, html_url: "", title: "" }
      );
      intercept({ method: "POST", path: /\/requested_reviewers$/ }, 201, {});

      await adapter.submitChanges({ ...kParams, reviewers: ["john", "bob"] });
    });

    it("should not request reviewers when reviewers is empty", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/branches\/main/ },
        200,
        { name: "main", commit: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: /\/git\/refs$/ },
        201,
        { ref: "refs/heads/rezzou/license-year-2026", object: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: "/graphql" },
        200,
        { data: { createCommitOnBranch: { commit: { oid: "new-sha" } } } }
      );
      intercept(
        { method: "POST", path: /\/pulls$/ },
        201,
        { number: 1, html_url: "", title: "" }
      );

      await adapter.submitChanges({ ...kParams, reviewers: [] });
    });

    it("should delete the head branch when the GraphQL commit fails", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/branches\/main/ },
        200,
        { name: "main", commit: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: /\/git\/refs$/ },
        201,
        { ref: "refs/heads/rezzou/license-year-2026", object: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: "/graphql" },
        500,
        { message: "GraphQL error" }
      );
      intercept({ method: "DELETE", path: /\/git\/refs\/heads/ }, 204, {});

      const error = await adapter.submitChanges(kParams).catch((err) => err);

      assert.ok(error instanceof Error);
      assert.equal(error.message, `Failed to commit changes to ${kParams.repoPath}`);
      assert.ok(error.cause instanceof Error);
    });

    it("should not delete the head branch when PR creation fails", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/branches\/main/ },
        200,
        { name: "main", commit: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: /\/git\/refs$/ },
        201,
        { ref: "refs/heads/rezzou/license-year-2026", object: { sha: "base-sha" } }
      );
      intercept(
        { method: "POST", path: "/graphql" },
        200,
        { data: { createCommitOnBranch: { commit: { oid: "new-sha" } } } }
      );
      intercept(
        { method: "POST", path: /\/pulls$/ },
        422,
        { message: "PR creation error" }
      );

      const error = await adapter.submitChanges(kParams).catch((err) => err);

      assert.ok(error instanceof Error);
      assert.equal(error.message, `Failed to create pull request for ${kParams.repoPath}`);
    });
  });

  describe("listMembers", () => {
    async function setupOrgAdapter(org: string) {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: "/user" }, 200, { login: "testuser", name: "Test User", avatar_url: null });
      intercept({ method: "GET", path: /^\/user\/orgs/ }, 200, [{ login: org, avatar_url: null }]);

      await adapter.listNamespaces();

      return { adapter, intercept };
    }

    async function setupUserAdapter(login: string) {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: "/user" }, 200, { login, name: login, avatar_url: null });
      intercept({ method: "GET", path: /^\/user\/orgs/ }, 200, []);

      await adapter.listNamespaces();

      return { adapter, intercept };
    }

    it("should return mapped org members", async() => {
      const { adapter, intercept } = await setupOrgAdapter("my-org");

      intercept({ method: "GET", path: /\/orgs\/my-org\/members/ }, 200, [
        { login: "john", avatar_url: "https://avatars.githubusercontent.com/u/1" },
        { login: "bob", avatar_url: "https://avatars.githubusercontent.com/u/2" }
      ]);

      const result = await adapter.listMembers("my-org");

      assert.deepEqual(result, [
        { username: "john", avatarUrl: "https://avatars.githubusercontent.com/u/1" },
        { username: "bob", avatarUrl: "https://avatars.githubusercontent.com/u/2" }
      ]);
    });

    it("should paginate members with per_page=100", async() => {
      const { adapter, intercept } = await setupOrgAdapter("my-org");

      intercept({ method: "GET", path: /\/orgs\/my-org\/members.*per_page=100/ }, 200, []);

      const result = await adapter.listMembers("my-org");

      assert.deepEqual(result, []);
    });

    it("should return all members when more than 100 exist", async() => {
      const { adapter, intercept } = await setupOrgAdapter("my-org");

      const manyMembers = Array.from({ length: 150 }, (_, index) => {
        return { login: `user-${index}`, avatar_url: null };
      });

      intercept({ method: "GET", path: /\/orgs\/my-org\/members/ }, 200, manyMembers);

      const result = await adapter.listMembers("my-org");

      assert.equal(result.length, 150);
    });

    it("should return empty array for user namespace", async() => {
      const { adapter } = await setupUserAdapter("john");

      const result = await adapter.listMembers("john");

      assert.deepEqual(result, []);
    });
  });

  describe("listTree", () => {
    it("should return only blob paths from the tree", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/git\/trees\/main/ }, 200, {
        tree: [
          { type: "tree", path: "src" },
          { type: "blob", path: "src/index.ts" },
          { type: "blob", path: "README.md" },
          { type: "tree", path: "src/utils" },
          { type: "blob", path: "src/utils/helper.ts" }
        ]
      });

      const result = await adapter.listTree("owner/repo", "main");

      assert.deepEqual(result, ["src/index.ts", "README.md", "src/utils/helper.ts"]);
    });

    it("should return empty array when repository is empty", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/git\/trees\/main/ }, 200, { tree: [] });

      const result = await adapter.listTree("owner/repo", "main");

      assert.deepEqual(result, []);
    });

    it("should call getTree with recursive flag", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/git\/trees\/develop.*recursive/ }, 200, { tree: [] });

      const result = await adapter.listTree("owner/my-repo", "develop");

      assert.deepEqual(result, []);
    });
  });
});
