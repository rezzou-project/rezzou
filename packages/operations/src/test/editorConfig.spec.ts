// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/core";

// Import Internal Dependencies
import { editorConfigOperation } from "../editorConfig.ts";

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

describe("editorConfigOperation", () => {
  it("should have 'editorconfig' as id", () => {
    assert.equal(editorConfigOperation.id, "editorconfig");
  });

  describe("apply", () => {
    it("should return a create patch when the file does not exist", async() => {
      const result = await editorConfigOperation.apply(makeCtx(null), {});

      assert.ok(result !== null);
      assert.equal(result[0].action, "create");
      assert.match(result[0].content, /indent_style = space/);
      assert.match(result[0].content, /indent_size = 2/);
      assert.match(result[0].content, /end_of_line = lf/);
      assert.match(result[0].content, /insert_final_newline = true/);
      assert.match(result[0].content, /charset = utf-8/);
      assert.match(result[0].content, /trim_trailing_whitespace = true/);
    });

    it("should return an update patch when the file is empty", async() => {
      const result = await editorConfigOperation.apply(makeCtx(""), {});

      assert.ok(result !== null);
      assert.equal(result[0].action, "update");
    });

    it("should return null when the file already has content", async() => {
      const result = await editorConfigOperation.apply(makeCtx("root = true\n"), {});

      assert.equal(result, null);
    });
  });
});
