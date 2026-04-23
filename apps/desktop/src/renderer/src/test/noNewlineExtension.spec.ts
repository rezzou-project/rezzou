// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { shouldCheckNewline, isMissingNewline } from "../utils/noNewlineExtension.ts";

describe("UT shouldCheckNewline", () => {
  it("should return true for .js", () => {
    assert.equal(shouldCheckNewline("index.js"), true);
  });

  it("should return true for .ts", () => {
    assert.equal(shouldCheckNewline("src/foo.ts"), true);
  });

  it("should return true for .mjs", () => {
    assert.equal(shouldCheckNewline("lib/entry.mjs"), true);
  });

  it("should return true for .cjs", () => {
    assert.equal(shouldCheckNewline("lib/entry.cjs"), true);
  });

  it("should return true for .mts", () => {
    assert.equal(shouldCheckNewline("lib/entry.mts"), true);
  });

  it("should return true for .cts", () => {
    assert.equal(shouldCheckNewline("lib/entry.cts"), true);
  });

  it("should return true for .tsx", () => {
    assert.equal(shouldCheckNewline("App.tsx"), true);
  });

  it("should return true for .jsx", () => {
    assert.equal(shouldCheckNewline("App.jsx"), true);
  });

  it("should return true for .json", () => {
    assert.equal(shouldCheckNewline("package.json"), true);
  });

  it("should return true for uppercase extension", () => {
    assert.equal(shouldCheckNewline("config.JSON"), true);
  });

  it("should return false for .md", () => {
    assert.equal(shouldCheckNewline("README.md"), false);
  });

  it("should return false for .css", () => {
    assert.equal(shouldCheckNewline("styles.css"), false);
  });

  it("should return false for .html", () => {
    assert.equal(shouldCheckNewline("index.html"), false);
  });

  it("should return false for files without extension", () => {
    assert.equal(shouldCheckNewline("Makefile"), false);
    assert.equal(shouldCheckNewline(".gitignore"), false);
  });
});

describe("UT isMissingNewline", () => {
  it("should return true when value does not end with newline", () => {
    assert.equal(isMissingNewline('{"foo":"bar"}'), true);
  });

  it("should return false when value ends with newline", () => {
    assert.equal(isMissingNewline('{"foo":"bar"}\n'), false);
  });

  it("should return false for empty string", () => {
    assert.equal(isMissingNewline(""), false);
  });

  it("should return false for a value that is only a newline", () => {
    assert.equal(isMissingNewline("\n"), false);
  });

  it("should return true for multi-line content without trailing newline", () => {
    assert.equal(isMissingNewline("line1\nline2\nline3"), true);
  });

  it("should return false for multi-line content with trailing newline", () => {
    assert.equal(isMissingNewline("line1\nline2\nline3\n"), false);
  });
});
