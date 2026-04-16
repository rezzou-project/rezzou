// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { gitignoreMaintainerOperation } from "../gitignoreMaintainer.ts";

describe("UT gitignoreMaintainerOperation", () => {
  it("should have .gitignore as filePath", () => {
    assert.equal(gitignoreMaintainerOperation.filePath, ".gitignore");
  });

  describe("apply", () => {
    it("should return all required entries for an empty file", () => {
      const result = gitignoreMaintainerOperation.apply("");

      assert.equal(result, ".temp\n.vscode/\ndist/\nnode_modules/\n.DS_Store\n*.log");
    });

    it("should return null when file already contains all entries", () => {
      const content = ".temp\n.vscode/\ndist/\nnode_modules/\n.DS_Store\n*.log\n";
      const result = gitignoreMaintainerOperation.apply(content);

      assert.equal(result, null);
    });

    it("should append only missing entries to a partial file", () => {
      const content = "node_modules/\ndist/\n";
      const result = gitignoreMaintainerOperation.apply(content);

      assert.equal(result, "node_modules/\ndist/\n.temp\n.vscode/\n.DS_Store\n*.log");
    });

    it("should add a newline separator when existing content does not end with newline", () => {
      const result = gitignoreMaintainerOperation.apply("node_modules/");

      assert.equal(result, "node_modules/\n.temp\n.vscode/\ndist/\n.DS_Store\n*.log");
    });

    it("should not alter the order of existing lines", () => {
      const content = "*.log\n.DS_Store\n";
      const result = gitignoreMaintainerOperation.apply(content);

      assert.ok(result!.startsWith("*.log\n.DS_Store\n"));
    });

    it("should not add duplicate entries", () => {
      const content = ".temp\n.temp\nnode_modules/\n";
      const result = gitignoreMaintainerOperation.apply(content);

      const lines = result!.split("\n").filter((line) => line.length > 0);
      const tempCount = lines.filter((line) => line === ".temp").length;
      assert.equal(tempCount, 2);

      const nodeModulesCount = lines.filter((line) => line === "node_modules/").length;
      assert.equal(nodeModulesCount, 1);
    });
  });
});
