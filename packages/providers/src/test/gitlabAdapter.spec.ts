
// Import Node.js Dependencies
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// CONSTANTS
const kToken = "test-token";

const mockAllProjects = mock.fn(async() => ([] as unknown[]));
const mockShow = mock.fn(async() => {
  return {};
});
const mockCommitsCreate = mock.fn(async() => undefined);
const mockMrCreate = mock.fn(async() => {
  return { web_url: "", title: "" };
});

const mockUsersAll = mock.fn(async() => ([] as unknown[]));
const mockShowCurrentUser = mock.fn(async() => {
  return { id: 1, username: "testuser", name: "Test User" };
});
const mockGroupMembersAll = mock.fn(async() => ([] as unknown[]));
const mockGroupsAll = mock.fn(async() => ([] as unknown[]));
const mockAllRepositoryTrees = mock.fn(async() => ([] as unknown[]));

mock.module("@gitbeaker/rest", {
  namedExports: {
    Gitlab: mock.fn(function MockGitlab() {
      return {
        Groups: { allProjects: mockAllProjects, all: mockGroupsAll },
        RepositoryFiles: { show: mockShow },
        Repositories: { allRepositoryTrees: mockAllRepositoryTrees },
        Commits: { create: mockCommitsCreate },
        MergeRequests: { create: mockMrCreate },
        Users: { all: mockUsersAll, showCurrentUser: mockShowCurrentUser },
        GroupMembers: { all: mockGroupMembersAll }
      };
    })
  }
});

const { GitLabAdapter } = await import("../gitlab.ts");

describe("GitLabAdapter", () => {
  beforeEach(() => {
    mockAllProjects.mock.resetCalls();
    mockShow.mock.resetCalls();
    mockCommitsCreate.mock.resetCalls();
    mockMrCreate.mock.resetCalls();
    mockUsersAll.mock.resetCalls();
    mockShowCurrentUser.mock.resetCalls();
    mockGroupMembersAll.mock.resetCalls();
    mockGroupsAll.mock.resetCalls();
    mockAllRepositoryTrees.mock.resetCalls();
  });

  describe("listNamespaces", () => {
    it("should return the authenticated user as a user namespace", async() => {
      mockShowCurrentUser.mock.mockImplementation(async() => {
        return { id: 42, username: "john", name: "John Doe" };
      });
      mockGroupsAll.mock.mockImplementation(async() => []);

      const adapter = new GitLabAdapter(kToken);
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
      mockShowCurrentUser.mock.mockImplementation(async() => {
        return { id: 1, username: "john", name: "John" };
      });
      mockGroupsAll.mock.mockImplementation(async() => [
        { id: 10, full_path: "my-org", name: "My Org" },
        { id: 11, full_path: "my-org/sub-group", name: "Sub Group" }
      ]);

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.listNamespaces();

      assert.equal(result.length, 3);
      assert.equal(result[0].type, "user");
      assert.equal(result[1].type, "org");
      assert.equal(result[1].name, "my-org");
      assert.equal(result[1].displayName, "My Org");
      assert.equal(result[2].name, "my-org/sub-group");
    });

    it("should call Groups.all with minAccessLevel and pagination options", async() => {
      mockShowCurrentUser.mock.mockImplementation(async() => {
        return { id: 1, username: "john", name: "John" };
      });
      mockGroupsAll.mock.mockImplementation(async() => []);

      const adapter = new GitLabAdapter(kToken);
      await adapter.listNamespaces();

      assert.equal(mockGroupsAll.mock.callCount(), 1);
      assert.deepEqual(mockGroupsAll.mock.calls[0].arguments, [
        { minAccessLevel: 20, perPage: 100 }
      ]);
    });

    it("should return all groups when more than 100 exist", async() => {
      const manyGroups = Array.from({ length: 150 }, (_, i) => {
        return { id: i, full_path: `group-${i}`, name: `Group ${i}` };
      });
      mockShowCurrentUser.mock.mockImplementationOnce(async() => {
        return { id: 1, username: "john", name: "John" };
      });
      mockGroupsAll.mock.mockImplementationOnce(async() => manyGroups);

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.listNamespaces();

      assert.equal(result.length, 151);
    });
  });

  describe("listRepos", () => {
    it("should map GitLab projects to Repo objects", async() => {
      mockAllProjects.mock.mockImplementation(async() => [
        {
          id: 42,
          name: "my-project",
          path_with_namespace: "ns/my-project",
          default_branch: "main",
          web_url: "https://gitlab.com/ns/my-project"
        }
      ]);

      const adapter = new GitLabAdapter(kToken);
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
      mockAllProjects.mock.mockImplementation(async() => [
        {
          id: 1,
          name: "repo",
          path_with_namespace: "ns/repo",
          default_branch: undefined,
          web_url: "https://gitlab.com/ns/repo"
        }
      ]);

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.listRepos("ns");

      assert.equal(result.length, 0);
    });

    it("should call allProjects with namespace and pagination options", async() => {
      mockAllProjects.mock.mockImplementation(async() => []);

      const adapter = new GitLabAdapter(kToken);
      await adapter.listRepos("my-org");

      assert.equal(mockAllProjects.mock.callCount(), 1);
      assert.deepEqual(mockAllProjects.mock.calls[0].arguments, [
        "my-org",
        { perPage: 100, archived: false }
      ]);
    });

    it("should return all repos when more than 100 exist", async() => {
      const manyProjects = Array.from({ length: 150 }, (_, i) => {
        return {
          id: i,
          name: `repo-${i}`,
          path_with_namespace: `ns/repo-${i}`,
          default_branch: "main",
          web_url: `https://gitlab.com/ns/repo-${i}`
        };
      });
      mockAllProjects.mock.mockImplementationOnce(async() => manyProjects);

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.listRepos("ns");

      assert.equal(result.length, 150);
    });
  });

  describe("getFile", () => {
    it("should return FileContent with base64-decoded content", async() => {
      const rawContent = "MIT License\nCopyright 2020";
      const encoded = Buffer.from(rawContent).toString("base64");

      mockShow.mock.mockImplementation(async() => {
        return { content: encoded };
      });

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.getFile("ns/repo", "LICENSE", "main");

      assert.deepEqual(result, { content: rawContent, ref: "main" });
    });

    it("should return null when file is not found", async() => {
      mockShow.mock.mockImplementation(async() => {
        throw new Error("404 Not Found");
      });

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.getFile("ns/repo", "LICENSE", "main");

      assert.equal(result, null);
    });

    it("should call show with repoPath, filePath, and branch", async() => {
      const encoded = Buffer.from("content").toString("base64");
      mockShow.mock.mockImplementation(async() => {
        return { content: encoded };
      });

      const adapter = new GitLabAdapter(kToken);
      await adapter.getFile("ns/repo", "LICENSE", "develop");

      assert.equal(mockShow.mock.callCount(), 1);
      assert.deepEqual(mockShow.mock.calls[0].arguments, ["ns/repo", "LICENSE", "develop"]);
    });
  });

  describe("submitChanges", () => {
    it("should create commit and merge request and return prUrl and prTitle", async() => {
      mockCommitsCreate.mock.mockImplementation(async() => undefined);
      mockMrCreate.mock.mockImplementation(async() => {
        return {
          web_url: "https://gitlab.com/ns/repo/-/merge_requests/1",
          title: "chore: update license year"
        };
      });

      const adapter = new GitLabAdapter(kToken);
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

    it("should call Commits.create with mapped file actions", async() => {
      mockCommitsCreate.mock.mockImplementation(async() => undefined);
      mockMrCreate.mock.mockImplementation(async() => {
        return { web_url: "", title: "" };
      });

      const adapter = new GitLabAdapter(kToken);
      await adapter.submitChanges({
        repoPath: "ns/repo",
        baseBranch: "main",
        headBranch: "rezzou/license-year-2026",
        commitMessage: "chore: update license year",
        prTitle: "chore: update license year",
        prDescription: "Automated update",
        files: [{ action: "update", path: "LICENSE", content: "MIT License 2026" }]
      });

      assert.equal(mockCommitsCreate.mock.callCount(), 1);
      assert.deepEqual(mockCommitsCreate.mock.calls[0].arguments, [
        "ns/repo",
        "rezzou/license-year-2026",
        "chore: update license year",
        [{ action: "update", filePath: "LICENSE", content: "MIT License 2026" }],
        { startBranch: "main" }
      ]);
    });

    it("should call MergeRequests.create with correct params", async() => {
      mockCommitsCreate.mock.mockImplementation(async() => undefined);
      mockMrCreate.mock.mockImplementation(async() => {
        return { web_url: "", title: "" };
      });

      const adapter = new GitLabAdapter(kToken);
      await adapter.submitChanges({
        repoPath: "ns/repo",
        baseBranch: "main",
        headBranch: "rezzou/license-year-2026",
        commitMessage: "chore: update license year",
        prTitle: "chore: update license year",
        prDescription: "Automated update",
        files: []
      });

      assert.equal(mockMrCreate.mock.callCount(), 1);
      assert.deepEqual(mockMrCreate.mock.calls[0].arguments, [
        "ns/repo",
        "rezzou/license-year-2026",
        "main",
        "chore: update license year",
        { description: "Automated update" }
      ]);
    });

    it("should pass reviewerIds when reviewers are provided", async() => {
      mockCommitsCreate.mock.mockImplementation(async() => undefined);
      mockMrCreate.mock.mockImplementation(async() => {
        return { web_url: "", title: "" };
      });
      mockUsersAll.mock.mockImplementation(async() => [{ username: "john", id: 42 }]);

      const adapter = new GitLabAdapter(kToken);
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

      assert.equal(mockMrCreate.mock.callCount(), 1);
      assert.deepEqual(mockMrCreate.mock.calls[0].arguments, [
        "ns/repo",
        "rezzou/update",
        "main",
        "chore: update",
        { description: "desc", reviewerIds: [42] }
      ]);
    });

    it("should throw when a reviewer username is not found", async() => {
      mockCommitsCreate.mock.mockImplementation(async() => undefined);
      mockUsersAll.mock.mockImplementation(async() => []);

      const adapter = new GitLabAdapter(kToken);

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
  });

  describe("listMembers", () => {
    it("should return mapped group members", async() => {
      mockGroupMembersAll.mock.mockImplementation(async() => [
        { username: "john", avatar_url: "https://gitlab.com/uploads/john/avatar.png" },
        { username: "bob", avatar_url: undefined }
      ]);

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.listMembers("my-group");

      assert.deepEqual(result, [
        { username: "john", avatarUrl: "https://gitlab.com/uploads/john/avatar.png" },
        { username: "bob", avatarUrl: undefined }
      ]);
    });

    it("should call GroupMembers.all with the namespace", async() => {
      mockGroupMembersAll.mock.mockImplementation(async() => []);

      const adapter = new GitLabAdapter(kToken);
      await adapter.listMembers("my-group");

      assert.equal(mockGroupMembersAll.mock.callCount(), 1);
      assert.deepEqual(mockGroupMembersAll.mock.calls[0].arguments, ["my-group"]);
    });

    it("should return all members when more than 100 exist", async() => {
      const manyMembers = Array.from({ length: 150 }, (_, i) => {
        return { username: `user-${i}`, avatar_url: undefined };
      });
      mockGroupMembersAll.mock.mockImplementationOnce(async() => manyMembers);

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.listMembers("my-group");

      assert.equal(result.length, 150);
    });
  });

  describe("listTree", () => {
    it("should return only blob paths from the tree", async() => {
      mockAllRepositoryTrees.mock.mockImplementation(async() => [
        { type: "tree", path: "src" },
        { type: "blob", path: "src/index.ts" },
        { type: "blob", path: "README.md" },
        { type: "tree", path: "src/utils" },
        { type: "blob", path: "src/utils/helper.ts" }
      ]);

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.listTree("ns/repo", "main");

      assert.deepEqual(result, ["src/index.ts", "README.md", "src/utils/helper.ts"]);
    });

    it("should return empty array when repository is empty", async() => {
      mockAllRepositoryTrees.mock.mockImplementation(async() => []);

      const adapter = new GitLabAdapter(kToken);
      const result = await adapter.listTree("ns/repo", "main");

      assert.deepEqual(result, []);
    });

    it("should call allRepositoryTrees with repoPath, branch, recursive and pagination", async() => {
      mockAllRepositoryTrees.mock.mockImplementation(async() => []);

      const adapter = new GitLabAdapter(kToken);
      await adapter.listTree("ns/my-repo", "develop");

      assert.equal(mockAllRepositoryTrees.mock.callCount(), 1);
      assert.deepEqual(mockAllRepositoryTrees.mock.calls[0].arguments, [
        "ns/my-repo",
        { ref: "develop", recursive: true, perPage: 100 }
      ]);
    });
  });
});
