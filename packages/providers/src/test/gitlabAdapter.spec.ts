
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

mock.module("@gitbeaker/rest", {
  namedExports: {
    Gitlab: mock.fn(function MockGitlab() {
      return {
        Groups: { allProjects: mockAllProjects },
        RepositoryFiles: { show: mockShow },
        Commits: { create: mockCommitsCreate },
        MergeRequests: { create: mockMrCreate }
      };
    })
  }
});

const { GitLabAdapter } = await import("../gitlab.ts");

describe("UT GitLabAdapter", () => {
  beforeEach(() => {
    mockAllProjects.mock.resetCalls();
    mockShow.mock.resetCalls();
    mockCommitsCreate.mock.resetCalls();
    mockMrCreate.mock.resetCalls();
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

    it("should default defaultBranch to main when project has no default_branch", async() => {
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
      const [repo] = await adapter.listRepos("ns");

      assert.equal(repo.defaultBranch, "main");
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
  });
});
