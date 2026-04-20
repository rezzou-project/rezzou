// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/sdk";

// Import Internal Dependencies
import { gitignoreMaintainerOperation } from "../gitignore-maintainer/gitignoreMaintainer.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

function makeCtx(content: string | null): RepoContext {
  return {
    repo: kRepo,
    provider: "gitlab",
    readFile: async() => content,
    listFiles: async() => [],
    exists: async() => content !== null
  };
}

describe("UT gitignoreMaintainerOperation", () => {
  it("should have 'gitignore-maintainer' as id", () => {
    assert.equal(gitignoreMaintainerOperation.id, "gitignore-maintainer");
  });

  describe("apply", () => {
    it("should return all required entries as a create patch for a non-existent file", async() => {
      const result = await gitignoreMaintainerOperation.apply(makeCtx(null), {});

      assert.ok(result !== null);
      assert.equal(result[0].action, "create");
      assert.equal(result[0].content, ".temp\n.vscode/\ndist/\nnode_modules/\n.DS_Store\n*.log");
    });

    it("should return all required entries as an update patch for an empty file", async() => {
      const result = await gitignoreMaintainerOperation.apply(makeCtx(""), {});

      assert.ok(result !== null);
      assert.equal(result[0].action, "update");
      assert.equal(result[0].content, ".temp\n.vscode/\ndist/\nnode_modules/\n.DS_Store\n*.log");
    });

    it("should return null when file already contains all entries", async() => {
      const content = ".temp\n.vscode/\ndist/\nnode_modules/\n.DS_Store\n*.log\n";
      const result = await gitignoreMaintainerOperation.apply(makeCtx(content), {});

      assert.equal(result, null);
    });

    it("should append only missing entries to a partial file", async() => {
      const content = "node_modules/\ndist/\n";
      const result = await gitignoreMaintainerOperation.apply(makeCtx(content), {});

      assert.ok(result !== null);
      assert.equal(result[0].action, "update");
      assert.equal(result[0].content, "node_modules/\ndist/\n.temp\n.vscode/\n.DS_Store\n*.log");
    });

    it("should add a newline separator when existing content does not end with newline", async() => {
      const result = await gitignoreMaintainerOperation.apply(makeCtx("node_modules/"), {});

      assert.ok(result !== null);
      assert.equal(result[0].content, "node_modules/\n.temp\n.vscode/\ndist/\n.DS_Store\n*.log");
    });

    it("should not alter the order of existing lines", async() => {
      const content = "*.log\n.DS_Store\n";
      const result = await gitignoreMaintainerOperation.apply(makeCtx(content), {});

      assert.ok(result !== null);
      assert.ok(result[0].content.startsWith("*.log\n.DS_Store\n"));
    });

    it("should not add duplicate entries", async() => {
      const content = ".temp\n.temp\nnode_modules/\n";
      const result = await gitignoreMaintainerOperation.apply(makeCtx(content), {});

      assert.ok(result !== null);
      const lines = result[0].content.split("\n").filter((line) => line.length > 0);
      const tempCount = lines.filter((line) => line === ".temp").length;
      assert.equal(tempCount, 2);

      const nodeModulesCount = lines.filter((line) => line === "node_modules/").length;
      assert.equal(nodeModulesCount, 1);
    });
  });
});
