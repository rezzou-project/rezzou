// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { appendUnique, removeMatching } from "../helpers/lines.ts";

describe("appendUnique", () => {
  it("should append a line if absent", () => {
    const result = appendUnique("foo\nbar\n", "baz");
    assert.equal(result, "foo\nbar\nbaz\n");
  });

  it("should not append if line already exists", () => {
    const result = appendUnique("foo\nbar\n", "foo");
    assert.equal(result, "foo\nbar\n");
  });

  it("should preserve trailing newline", () => {
    assert.ok(appendUnique("foo\n", "bar").endsWith("\n"));
  });

  it("should work without trailing newline", () => {
    const result = appendUnique("foo\nbar", "baz");
    assert.equal(result, "foo\nbar\nbaz");
  });
});

describe("removeMatching", () => {
  it("should remove lines containing a string pattern", () => {
    const result = removeMatching("foo\nbar\nbaz\n", "bar");
    assert.equal(result, "foo\nbaz\n");
  });

  it("should remove lines matching a regex", () => {
    const result = removeMatching("foo\n# comment\nbar\n", /^#/);
    assert.equal(result, "foo\nbar\n");
  });

  it("should return content unchanged if nothing matches", () => {
    const content = "foo\nbar\n";
    assert.equal(removeMatching(content, "baz"), content);
  });

  it("should preserve trailing newline", () => {
    assert.ok(removeMatching("foo\nbar\n", "foo").endsWith("\n"));
  });
});
