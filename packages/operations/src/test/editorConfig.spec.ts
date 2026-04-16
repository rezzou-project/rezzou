// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { editorConfigOperation } from "../editorConfig.ts";

describe("editorConfigOperation", () => {
  it("should have .editorconfig as filePath", () => {
    assert.equal(editorConfigOperation.filePath, ".editorconfig");
  });

  describe("apply", () => {
    it("should return the template when the file is empty", () => {
      const result = editorConfigOperation.apply("");

      assert.ok(result !== null);
      assert.match(result, /indent_style = space/);
      assert.match(result, /indent_size = 2/);
      assert.match(result, /end_of_line = lf/);
      assert.match(result, /insert_final_newline = true/);
      assert.match(result, /charset = utf-8/);
      assert.match(result, /trim_trailing_whitespace = true/);
    });

    it("should return null when the file already has content", () => {
      const result = editorConfigOperation.apply("root = true\n");

      assert.equal(result, null);
    });
  });
});
