// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/sdk";

// Import Internal Dependencies
import { addFileOperation } from "../add-file/addFile.ts";

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

const kDefaultInputs = { path: "CODEOWNERS", content: "* @org/team" };

describe("addFileOperation", () => {
  it("should have 'add-file' as id", () => {
    assert.equal(addFileOperation.id, "add-file");
  });

  describe("apply", () => {
    it("should create the file when it does not exist", async() => {
      const result = await addFileOperation.apply(makeCtx(null), kDefaultInputs);

      assert.ok(result !== null);
      assert.equal(result[0].action, "create");
      assert.equal(result[0].path, "CODEOWNERS");
      assert.equal(result[0].content, "* @org/team");
    });

    it("should return null when file exists and overwrite is false (default)", async() => {
      const result = await addFileOperation.apply(makeCtx("* @other/team"), kDefaultInputs);

      assert.equal(result, null);
    });

    it("should return null when file exists and overwrite is explicitly false", async() => {
      const result = await addFileOperation.apply(makeCtx("* @other/team"), {
        ...kDefaultInputs,
        overwrite: false
      });

      assert.equal(result, null);
    });

    it("should update the file when it exists and overwrite is true", async() => {
      const result = await addFileOperation.apply(makeCtx("* @other/team"), {
        ...kDefaultInputs,
        overwrite: true
      });

      assert.ok(result !== null);
      assert.equal(result[0].action, "update");
      assert.equal(result[0].path, "CODEOWNERS");
      assert.equal(result[0].content, "* @org/team");
    });

    it("should support nested paths", async() => {
      const result = await addFileOperation.apply(makeCtx(null), {
        path: ".github/CODEOWNERS",
        content: "* @org/team"
      });

      assert.ok(result !== null);
      assert.equal(result[0].path, ".github/CODEOWNERS");
    });
  });

  describe("branchName", () => {
    it("should slugify the file path", () => {
      assert.equal(
        addFileOperation.branchName({ path: ".github/CODEOWNERS", content: "" }),
        "rezzou/add-file-github-CODEOWNERS"
      );
    });

    it("should handle simple paths", () => {
      assert.equal(
        addFileOperation.branchName(kDefaultInputs),
        "rezzou/add-file-CODEOWNERS"
      );
    });
  });

  describe("commitMessage", () => {
    it("should include the file path", () => {
      assert.equal(addFileOperation.commitMessage(kDefaultInputs), "chore: add CODEOWNERS");
    });
  });

  describe("prTitle", () => {
    it("should include the file path", () => {
      assert.equal(addFileOperation.prTitle(kDefaultInputs), "chore: add CODEOWNERS");
    });
  });
});
