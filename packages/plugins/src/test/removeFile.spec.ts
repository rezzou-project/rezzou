// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/sdk";

// Import Internal Dependencies
import { removeFileOperation } from "../remove-file/removeFile.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

function makeCtx(existingContent: string | null): RepoContext {
  return {
    repo: kRepo,
    provider: "gitlab",
    readFile: async() => existingContent,
    listFiles: async() => [],
    exists: async() => existingContent !== null
  };
}

// CONSTANTS
const kDefaultInputs = { path: "CODEOWNERS" };

describe("removeFileOperation", () => {
  it("should have 'remove-file' as id", () => {
    assert.equal(removeFileOperation.id, "remove-file");
  });

  describe("apply", () => {
    it("should return null when file does not exist", async() => {
      const result = await removeFileOperation.apply(makeCtx(null), kDefaultInputs);

      assert.equal(result, null);
    });

    it("should delete the file when it exists", async() => {
      const result = await removeFileOperation.apply(makeCtx("* @org/team"), kDefaultInputs);

      assert.ok(result !== null);
      assert.equal(result[0].action, "delete");
      assert.equal(result[0].path, "CODEOWNERS");
    });

    it("should support nested paths", async() => {
      const result = await removeFileOperation.apply(makeCtx("* @org/team"), {
        path: ".github/CODEOWNERS"
      });

      assert.ok(result !== null);
      assert.equal(result[0].path, ".github/CODEOWNERS");
    });
  });

  describe("branchName", () => {
    it("should slugify the file path", () => {
      assert.equal(
        removeFileOperation.branchName({ path: ".github/CODEOWNERS" }),
        "rezzou/remove-file-github-CODEOWNERS"
      );
    });

    it("should handle simple paths", () => {
      assert.equal(
        removeFileOperation.branchName(kDefaultInputs),
        "rezzou/remove-file-CODEOWNERS"
      );
    });
  });

  describe("commitMessage", () => {
    it("should include the file path", () => {
      assert.equal(removeFileOperation.commitMessage(kDefaultInputs), "chore: remove CODEOWNERS");
    });
  });

  describe("prTitle", () => {
    it("should include the file path", () => {
      assert.equal(removeFileOperation.prTitle(kDefaultInputs), "chore: remove CODEOWNERS");
    });
  });
});
