// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/sdk";

// Import Internal Dependencies
import { replacePatternOperation } from "../replace-pattern/replacePattern.ts";

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

const kDefaultInputs = {
  path: "README.md",
  pattern: "Copyright \\d{4}",
  flags: "g",
  replacement: "Copyright 2025"
};

describe("replacePatternOperation", () => {
  it("should have 'replace-pattern' as id", () => {
    assert.equal(replacePatternOperation.id, "replace-pattern");
  });

  describe("apply", () => {
    it("should return null when file does not exist", async() => {
      const result = await replacePatternOperation.apply(makeCtx(null), kDefaultInputs);

      assert.equal(result, null);
    });

    it("should return null when pattern does not match", async() => {
      const result = await replacePatternOperation.apply(
        makeCtx("# My Project\nNo copyright here."),
        kDefaultInputs
      );

      assert.equal(result, null);
    });

    it("should return an update patch when pattern matches", async() => {
      const result = await replacePatternOperation.apply(
        makeCtx("# My Project\nCopyright 2023 ACME"),
        kDefaultInputs
      );

      assert.ok(result !== null);
      assert.equal(result.length, 1);
      assert.equal(result[0].action, "update");
      assert.equal(result[0].path, "README.md");
      assert.equal(result[0].content, "# My Project\nCopyright 2025 ACME");
    });

    it("should replace all occurrences with global flag", async() => {
      const result = await replacePatternOperation.apply(
        makeCtx("Copyright 2020\nCopyright 2021\nCopyright 2022"),
        kDefaultInputs
      );

      assert.ok(result !== null);
      assert.equal(result[0].content, "Copyright 2025\nCopyright 2025\nCopyright 2025");
    });

    it("should support regex capture groups in replacement", async() => {
      const result = await replacePatternOperation.apply(
        makeCtx("version: 1.2.3"),
        {
          path: "README.md",
          pattern: "version: (\\d+)\\.\\d+\\.\\d+",
          flags: "g",
          replacement: "version: $1.0.0"
        }
      );

      assert.ok(result !== null);
      assert.equal(result[0].content, "version: 1.0.0");
    });

    it("should support case-insensitive flag", async() => {
      const result = await replacePatternOperation.apply(
        makeCtx("TODO: fix this\ntodo: fix that"),
        {
          path: "README.md",
          pattern: "todo:",
          flags: "gi",
          replacement: "DONE:"
        }
      );

      assert.ok(result !== null);
      assert.equal(result[0].content, "DONE: fix this\nDONE: fix that");
    });
  });

  describe("branchName", () => {
    it("should slugify the file path", () => {
      assert.equal(
        replacePatternOperation.branchName(kDefaultInputs),
        "rezzou/replace-pattern-README-md"
      );
    });
  });

  describe("commitMessage", () => {
    it("should include the file path", () => {
      assert.equal(
        replacePatternOperation.commitMessage(kDefaultInputs),
        "chore: replace pattern in README.md"
      );
    });
  });

  describe("prTitle", () => {
    it("should include the file path", () => {
      assert.equal(
        replacePatternOperation.prTitle(kDefaultInputs),
        "chore: replace pattern in README.md"
      );
    });
  });
});
