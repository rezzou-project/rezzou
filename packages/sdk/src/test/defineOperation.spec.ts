// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/core";

// Import Internal Dependencies
import { defineOperation } from "../defineOperation.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

const kCtx: RepoContext = {
  repo: kRepo,
  provider: "gitlab",
  readFile: async() => null,
  listFiles: async() => [],
  exists: async() => false
};

describe("defineOperation", () => {
  it("should return the operation unchanged", () => {
    const op = defineOperation({
      id: "test-op",
      name: "Test Op",
      description: "A test operation",
      apply: async() => null,
      branchName: () => "rezzou/test",
      commitMessage: () => "chore: test",
      prTitle: () => "chore: test",
      prDescription: () => "test description"
    });

    assert.strictEqual(typeof op.apply, "function");
    assert.equal(op.id, "test-op");
  });

  it("should preserve the apply function behavior", async() => {
    const op = defineOperation({
      id: "test-op",
      name: "Test Op",
      description: "A test operation",
      apply: async() => null,
      branchName: () => "rezzou/test",
      commitMessage: () => "chore: test",
      prTitle: () => "chore: test",
      prDescription: () => "test description"
    });

    const result = await op.apply(kCtx, {});
    assert.equal(result, null);
  });
});
