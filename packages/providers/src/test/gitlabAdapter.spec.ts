// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MockAgent, type MockPool } from "@openally/httpie";

// Import Internal Dependencies
import { GitLabAdapter } from "../gitlab.ts";

// CONSTANTS
const kToken = "test-token";
const kGitlabOrigin = "https://gitlab.com";
const kJson = { headers: { "content-type": "application/json" } };

type InterceptOptions = Parameters<MockPool["intercept"]>[0];

function createTestSetup() {
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  const mockPool = mockAgent.get(kGitlabOrigin);

  function intercept(options: InterceptOptions, status: number, body: unknown) {
    return mockPool.intercept(options).reply(status, body, kJson);
  }

  const adapter = new GitLabAdapter(kToken, { agent: mockAgent });

  return { adapter, intercept };
}

describe("GitLabAdapter", () => {
  describe("listNamespaces", () => {
    it("should return the authenticated user as a user namespace", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/api\/v4\/user$/ },
        200,
        { id: 42, username: "john", name: "John Doe", avatar_url: null }
      );
      intercept({ method: "GET", path: /\/api\/v4\/groups/ }, 200, []);

      const result = await adapter.listNamespaces();

      assert.equal(result.length, 1);
      assert.deepEqual(result[0], {
        id: "42",
        name: "john",
        displayName: "John Doe",
        type: "user",
        provider: "gitlab",
        avatarUrl: void 0
      });
    });

    it("should return group namespaces alongside the user namespace", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/api\/v4\/user$/ },
        200,
        { id: 1, username: "john", name: "John", avatar_url: null }
      );
      intercept({ method: "GET", path: /\/api\/v4\/groups/ }, 200, [
        { id: 10, full_path: "my-org", name: "My Org", avatar_url: null },
        { id: 11, full_path: "my-org/sub-group", name: "Sub Group", avatar_url: null }
      ]);

      const result = await adapter.listNamespaces();

      assert.equal(result.length, 3);
      assert.equal(result[0].type, "user");
      assert.equal(result[1].type, "org");
      assert.equal(result[1].name, "my-org");
      assert.equal(result[1].displayName, "My Org");
      assert.equal(result[2].name, "my-org/sub-group");
    });

    it("should call Groups.all with minAccessLevel and pagination options", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/api\/v4\/user$/ },
        200,
        { id: 1, username: "john", name: "John", avatar_url: null }
      );
      intercept({ method: "GET", path: /\/api\/v4\/groups.*min_access_level=20.*per_page=100/ }, 200, []);

      const result = await adapter.listNamespaces();

      assert.equal(result.length, 1);
    });

    it("should return all groups when more than 100 exist", async() => {
      const { adapter, intercept } = createTestSetup();

      const manyGroups = Array.from({ length: 150 }, (_, index) => {
        return { id: index, full_path: `group-${index}`, name: `Group ${index}`, avatar_url: null };
      });

      intercept(
        { method: "GET", path: /\/api\/v4\/user$/ },
        200,
        { id: 1, username: "john", name: "John", avatar_url: null }
      );
      intercept({ method: "GET", path: /\/api\/v4\/groups/ }, 200, manyGroups);

      const result = await adapter.listNamespaces();

      assert.equal(result.length, 151);
    });
  });

  describe("listRepos", () => {
    it("should map GitLab projects to Repo objects", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/api\/v4\/groups\/ns\/projects/ }, 200, [
        {
          id: 42,
          name: "my-project",
          path_with_namespace: "ns/my-project",
          default_branch: "main",
          web_url: "https://gitlab.com/ns/my-project"
        }
      ]);

      const result = await adapter.listRepos("ns");

      assert.deepEqual(result, [
        {
          id: "42",
          name: "my-project",
          fullPath: "ns/my-project",
          defaultBranch: "main",
          url: "https://gitlab.com/ns/my-project"
        }
      ]);
    });

    it("should skip repos with no default_branch", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/api\/v4\/groups\/ns\/projects/ }, 200, [
        {
          id: 1,
          name: "repo",
          path_with_namespace: "ns/repo",
          default_branch: null,
          web_url: "https://gitlab.com/ns/repo"
        }
      ]);

      const result = await adapter.listRepos("ns");

      assert.equal(result.length, 0);
    });

    it("should call allProjects with pagination options", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/api\/v4\/groups\/my-org\/projects.*per_page=100/ }, 200, []);

      const result = await adapter.listRepos("my-org");

      assert.deepEqual(result, []);
    });

    it("should return all repos when more than 100 exist", async() => {
      const { adapter, intercept } = createTestSetup();

      const manyProjects = Array.from({ length: 150 }, (_, index) => {
        return {
          id: index,
          name: `repo-${index}`,
          path_with_namespace: `ns/repo-${index}`,
          default_branch: "main",
          web_url: `https://gitlab.com/ns/repo-${index}`
        };
      });

      intercept({ method: "GET", path: /\/api\/v4\/groups\/ns\/projects/ }, 200, manyProjects);

      const result = await adapter.listRepos("ns");

      assert.equal(result.length, 150);
    });
  });

  describe("getFile", () => {
    it("should return FileContent with base64-decoded content", async() => {
      const { adapter, intercept } = createTestSetup();
      const rawContent = "MIT License\nCopyright 2020";
      const encoded = Buffer.from(rawContent).toString("base64");

      intercept(
        { method: "GET", path: /\/api\/v4\/projects\/.*\/repository\/files\/LICENSE/ },
        200,
        { content: encoded, file_name: "LICENSE", ref: "main" }
      );

      const result = await adapter.getFile("ns/repo", "LICENSE", "main");

      assert.deepEqual(result, { content: rawContent, ref: "main" });
    });

    it("should return null when file is not found", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/api\/v4\/projects\/.*\/repository\/files\/LICENSE/ },
        404,
        { message: "404 File Not Found" }
      );

      const result = await adapter.getFile("ns/repo", "LICENSE", "main");

      assert.equal(result, null);
    });

    it("should request the file with the correct branch ref", async() => {
      const { adapter, intercept } = createTestSetup();
      const encoded = Buffer.from("content").toString("base64");

      intercept(
        { method: "GET", path: /\/repository\/files\/LICENSE.*ref=develop/ },
        200,
        { content: encoded, file_name: "LICENSE", ref: "develop" }
      );

      const result = await adapter.getFile("ns/repo", "LICENSE", "develop");

      assert.ok(result !== null);
      assert.equal(result.ref, "develop");
    });
  });

  describe("submitChanges", () => {
    it("should create commit and merge request and return prUrl and prTitle", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "POST", path: /\/api\/v4\/projects\/.*\/repository\/commits/ },
        201,
        { id: "abc123" }
      );
      intercept({ method: "POST", path: /\/api\/v4\/projects\/.*\/merge_requests$/ }, 201, {
        web_url: "https://gitlab.com/ns/repo/-/merge_requests/1",
        title: "chore: update license year"
      });

      const result = await adapter.submitChanges({
        repoPath: "ns/repo",
        baseBranch: "main",
        headBranch: "rezzou/license-year-2026",
        commitMessage: "chore: update license year",
        prTitle: "chore: update license year",
        prDescription: "Automated update",
        files: [{ action: "update", path: "LICENSE", content: "MIT License 2026" }]
      });

      assert.deepEqual(result, {
        prUrl: "https://gitlab.com/ns/repo/-/merge_requests/1",
        prTitle: "chore: update license year"
      });
    });

    it("should pass reviewerIds when reviewers are provided", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept(
        { method: "GET", path: /\/api\/v4\/users.*username=john/ },
        200,
        [{ id: 42, username: "john" }]
      );
      intercept({ method: "POST", path: /\/repository\/commits/ }, 201, { id: "abc123" });
      intercept({ method: "POST", path: /\/merge_requests$/ }, 201, { web_url: "", title: "" });

      await adapter.submitChanges({
        repoPath: "ns/repo",
        baseBranch: "main",
        headBranch: "rezzou/update",
        commitMessage: "chore: update",
        prTitle: "chore: update",
        prDescription: "desc",
        reviewers: ["john"],
        files: []
      });
    });

    it("should throw when a reviewer username is not found", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/api\/v4\/users.*username=ghost/ }, 200, []);
      intercept({ method: "POST", path: /\/repository\/commits/ }, 201, { id: "abc123" });

      await assert.rejects(
        () => adapter.submitChanges({
          repoPath: "ns/repo",
          baseBranch: "main",
          headBranch: "rezzou/update",
          commitMessage: "chore: update",
          prTitle: "chore: update",
          prDescription: "desc",
          reviewers: ["ghost"],
          files: []
        }),
        { message: "Unknown reviewer: ghost" }
      );
    });

    it("should remove the head branch when MR creation fails", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "POST", path: /\/repository\/commits/ }, 201, { id: "abc123" });
      intercept({ method: "POST", path: /\/merge_requests$/ }, 422, { message: "MR creation error" });
      intercept({ method: "DELETE", path: /\/repository\/branches\/rezzou/ }, 204, {});

      const error = await adapter.submitChanges({
        repoPath: "ns/repo",
        baseBranch: "main",
        headBranch: "rezzou/update",
        commitMessage: "chore: update",
        prTitle: "chore: update",
        prDescription: "desc",
        files: []
      }).catch((err) => err);

      assert.ok(error instanceof Error);
      assert.equal(error.message, "Failed to create merge request for ns/repo");
    });

    it("should preserve the original error as cause when MR creation fails", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "POST", path: /\/repository\/commits/ }, 201, { id: "abc123" });
      intercept({ method: "POST", path: /\/merge_requests$/ }, 422, { message: "MR creation error" });
      intercept({ method: "DELETE", path: /\/repository\/branches\/rezzou/ }, 204, {});

      const error = await adapter.submitChanges({
        repoPath: "ns/repo",
        baseBranch: "main",
        headBranch: "rezzou/update",
        commitMessage: "chore: update",
        prTitle: "chore: update",
        prDescription: "desc",
        files: []
      }).catch((err) => err);

      assert.ok(error instanceof Error);
      assert.ok(error.cause instanceof Error);
    });
  });

  describe("listMembers", () => {
    it("should return mapped group members", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/api\/v4\/groups\/my-group\/members/ }, 200, [
        { username: "john", avatar_url: "https://gitlab.com/uploads/john/avatar.png" },
        { username: "bob", avatar_url: null }
      ]);

      const result = await adapter.listMembers("my-group");

      assert.deepEqual(result, [
        { username: "john", avatarUrl: "https://gitlab.com/uploads/john/avatar.png" },
        { username: "bob", avatarUrl: void 0 }
      ]);
    });

    it("should return all members when more than 100 exist", async() => {
      const { adapter, intercept } = createTestSetup();

      const manyMembers = Array.from({ length: 150 }, (_, index) => {
        return { username: `user-${index}`, avatar_url: null };
      });

      intercept({ method: "GET", path: /\/api\/v4\/groups\/my-group\/members/ }, 200, manyMembers);

      const result = await adapter.listMembers("my-group");

      assert.equal(result.length, 150);
    });
  });

  describe("listTree", () => {
    it("should return only blob paths from the tree", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/api\/v4\/projects\/.*\/repository\/tree/ }, 200, [
        { type: "tree", path: "src" },
        { type: "blob", path: "src/index.ts" },
        { type: "blob", path: "README.md" },
        { type: "tree", path: "src/utils" },
        { type: "blob", path: "src/utils/helper.ts" }
      ]);

      const result = await adapter.listTree("ns/repo", "main");

      assert.deepEqual(result, ["src/index.ts", "README.md", "src/utils/helper.ts"]);
    });

    it("should return empty array when repository is empty", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/api\/v4\/projects\/.*\/repository\/tree/ }, 200, []);

      const result = await adapter.listTree("ns/repo", "main");

      assert.deepEqual(result, []);
    });

    it("should request the tree with recursive flag", async() => {
      const { adapter, intercept } = createTestSetup();

      intercept({ method: "GET", path: /\/repository\/tree.*recursive=true/ }, 200, []);

      const result = await adapter.listTree("ns/my-repo", "develop");

      assert.deepEqual(result, []);
    });
  });
});
