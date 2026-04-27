// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { isGitUrl, parseGitUrl } from "../git-plugin-store.ts";

describe("isGitUrl", () => {
  it("should return true for git+https:// URLs", () => {
    assert.ok(isGitUrl("git+https://github.com/example/plugin"));
  });

  it("should return true for git+ssh:// URLs", () => {
    assert.ok(isGitUrl("git+ssh://git@github.com/example/plugin"));
  });

  it("should return true for git@ SCP URLs", () => {
    assert.ok(isGitUrl("git@github.com:user/repo"));
  });

  it("should return true for bare github.com HTTPS URLs", () => {
    assert.ok(isGitUrl("https://github.com/user/repo"));
  });

  it("should return true for bare gitlab.com HTTPS URLs", () => {
    assert.ok(isGitUrl("https://gitlab.com/user/repo"));
  });

  it("should return false for file paths", () => {
    assert.equal(isGitUrl("/path/to/plugin.ts"), false);
  });

  it("should return false for arbitrary HTTPS URLs", () => {
    assert.equal(isGitUrl("https://example.com/plugin"), false);
  });
});

describe("UT parseGitUrl", () => {
  it("should parse a git+https:// URL with no ref", () => {
    const result = parseGitUrl("git+https://github.com/example/plugin");

    assert.deepEqual(result, {
      cloneUrl: "https://github.com/example/plugin",
      ref: null,
      slug: "github.com-example-plugin"
    });
  });

  it("should extract a tag ref from the #ref suffix", () => {
    const result = parseGitUrl("git+https://github.com/example/plugin#v1.0.0");

    assert.deepEqual(result, {
      cloneUrl: "https://github.com/example/plugin",
      ref: "v1.0.0",
      slug: "github.com-example-plugin"
    });
  });

  it("should extract a branch ref from the #ref suffix", () => {
    const result = parseGitUrl("git+https://github.com/example/plugin#main");

    assert.equal(result?.ref, "main");
  });

  it("should extract a commit hash ref from the #ref suffix", () => {
    const result = parseGitUrl("git+https://github.com/example/plugin#abc1234");

    assert.equal(result?.ref, "abc1234");
  });

  it("should parse a git@ SCP URL", () => {
    const result = parseGitUrl("git@github.com:user/repo");

    assert.deepEqual(result, {
      cloneUrl: "git@github.com:user/repo",
      ref: null,
      slug: "github.com-user-repo"
    });
  });

  it("should parse a git+ssh:// URL", () => {
    const result = parseGitUrl("git+ssh://git@github.com/user/repo");

    assert.deepEqual(result, {
      cloneUrl: "ssh://git@github.com/user/repo",
      ref: null,
      slug: "github.com-user-repo"
    });
  });

  it("should strip the .git suffix from the slug", () => {
    const result = parseGitUrl("https://github.com/user/repo.git");

    assert.equal(result?.slug, "github.com-user-repo");
  });

  it("should keep the .git suffix in the clone URL", () => {
    const result = parseGitUrl("https://github.com/user/repo.git");

    assert.equal(result?.cloneUrl, "https://github.com/user/repo.git");
  });

  it("should parse a bare github.com URL with a ref", () => {
    const result = parseGitUrl("https://github.com/user/repo#v2.0.0");

    assert.deepEqual(result, {
      cloneUrl: "https://github.com/user/repo",
      ref: "v2.0.0",
      slug: "github.com-user-repo"
    });
  });
});
