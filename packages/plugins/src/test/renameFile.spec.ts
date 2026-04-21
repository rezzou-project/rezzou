// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/sdk";

// Import Internal Dependencies
import { renameFileOperation } from "../rename-file/renameFile.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

function makeCtx(fromContent: string | null, destinationExists = false): RepoContext {
  return {
    repo: kRepo,
    provider: "gitlab",
    readFile: async() => fromContent,
    listFiles: async() => [],
    exists: async() => destinationExists
  };
}

const kDefaultInputs = { from: "CHANGELOG.md", to: "docs/CHANGELOG.md" };

describe("renameFileOperation", () => {
  it("should have 'rename-file' as id", () => {
    assert.equal(renameFileOperation.id, "rename-file");
  });

  describe("apply", () => {
    it("should return null when source file does not exist", async() => {
      const result = await renameFileOperation.apply(makeCtx(null), kDefaultInputs);

      assert.equal(result, null);
    });

    it("should return null when destination already exists", async() => {
      const result = await renameFileOperation.apply(makeCtx("content", true), kDefaultInputs);

      assert.equal(result, null);
    });

    it("should create destination and delete source", async() => {
      const result = await renameFileOperation.apply(makeCtx("# Changelog"), kDefaultInputs);

      assert.ok(result !== null);
      assert.equal(result.length, 2);

      const create = result.find((p) => p.action === "create");
      const del = result.find((p) => p.action === "delete");

      assert.ok(create !== undefined);
      assert.equal(create.path, "docs/CHANGELOG.md");
      assert.equal(create.content, "# Changelog");

      assert.ok(del !== undefined);
      assert.equal(del.path, "CHANGELOG.md");
    });

    it("should preserve file content exactly", async() => {
      const content = "line1\nline2\nline3\n";
      const result = await renameFileOperation.apply(makeCtx(content), kDefaultInputs);

      assert.ok(result !== null);
      const create = result.find((p) => p.action === "create");
      assert.equal(create?.content, content);
    });
  });

  describe("branchName", () => {
    it("should slugify both paths", () => {
      assert.equal(
        renameFileOperation.branchName(kDefaultInputs),
        "rezzou/rename-file-CHANGELOG-md-to-docs-CHANGELOG-md"
      );
    });
  });

  describe("commitMessage", () => {
    it("should include both paths", () => {
      assert.equal(
        renameFileOperation.commitMessage(kDefaultInputs),
        "chore: rename CHANGELOG.md to docs/CHANGELOG.md"
      );
    });
  });

  describe("prTitle", () => {
    it("should include both paths", () => {
      assert.equal(
        renameFileOperation.prTitle(kDefaultInputs),
        "chore: rename CHANGELOG.md to docs/CHANGELOG.md"
      );
    });
  });
});
