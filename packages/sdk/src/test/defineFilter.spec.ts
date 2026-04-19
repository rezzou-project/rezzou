// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/core";

// Import Internal Dependencies
import { defineFilter } from "../defineFilter.ts";

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

describe("defineFilter", () => {
  it("should return the filter unchanged", () => {
    const filter = defineFilter({
      id: "test-filter",
      name: "Test Filter",
      test: async() => true
    });

    assert.equal(filter.id, "test-filter");
    assert.equal(typeof filter.test, "function");
  });

  it("should preserve the test function behavior", async() => {
    const filter = defineFilter({
      id: "has-main",
      name: "Has main branch",
      test: async(ctx) => ctx.repo.defaultBranch === "main"
    });

    assert.equal(await filter.test(kCtx), true);
  });
});
