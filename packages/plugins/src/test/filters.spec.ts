// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/sdk";

// Import Internal Dependencies
import { hasFile } from "../filters/hasFile.ts";
import { fileContains } from "../filters/fileContains.ts";
import { defaultBranchIs } from "../filters/defaultBranchIs.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

function makeCtx(options: {
  files?: Record<string, string>;
  defaultBranch?: string;
}): RepoContext {
  const { files = {}, defaultBranch = "main" } = options;
  const repo = { ...kRepo, defaultBranch };

  return {
    repo,
    provider: "gitlab",
    readFile: async(path) => files[path] ?? null,
    listFiles: async() => [],
    exists: async(path) => path in files
  };
}

describe("hasFile", () => {
  it("should have 'has-file' as id", () => {
    assert.equal(hasFile("README.md").id, "has-file");
  });

  it("should include the path in description", () => {
    assert.equal(hasFile("README.md").description, "Repository contains README.md");
  });

  it("should return true when the file exists", async() => {
    const filter = hasFile("README.md");
    const result = await filter.test(makeCtx({ files: { "README.md": "# Hello" } }));

    assert.equal(result, true);
  });

  it("should return false when the file does not exist", async() => {
    const filter = hasFile("README.md");
    const result = await filter.test(makeCtx({ files: {} }));

    assert.equal(result, false);
  });

  it("should check the exact path", async() => {
    const filter = hasFile(".github/CODEOWNERS");
    const result = await filter.test(makeCtx({ files: { ".github/CODEOWNERS": "* @org/team" } }));

    assert.equal(result, true);
  });
});

describe("fileContains", () => {
  it("should have 'file-contains' as id", () => {
    assert.equal(fileContains("LICENSE", "MIT").id, "file-contains");
  });

  it("should include path and search in description", () => {
    assert.equal(fileContains("LICENSE", "MIT").description, `LICENSE contains "MIT"`);
  });

  it("should return true when the file contains the search string", async() => {
    const filter = fileContains("LICENSE", "MIT License");
    const result = await filter.test(makeCtx({ files: { LICENSE: "MIT License\nCopyright 2024" } }));

    assert.equal(result, true);
  });

  it("should return false when the file does not contain the search string", async() => {
    const filter = fileContains("LICENSE", "Apache");
    const result = await filter.test(makeCtx({ files: { LICENSE: "MIT License" } }));

    assert.equal(result, false);
  });

  it("should return false when the file does not exist", async() => {
    const filter = fileContains("LICENSE", "MIT");
    const result = await filter.test(makeCtx({ files: {} }));

    assert.equal(result, false);
  });

  it("should be case-sensitive", async() => {
    const filter = fileContains("LICENSE", "mit license");
    const result = await filter.test(makeCtx({ files: { LICENSE: "MIT License" } }));

    assert.equal(result, false);
  });
});

describe("defaultBranchIs", () => {
  it("should have 'default-branch-is' as id", () => {
    assert.equal(defaultBranchIs("main").id, "default-branch-is");
  });

  it("should include the branch in description", () => {
    assert.equal(defaultBranchIs("main").description, `Default branch is "main"`);
  });

  it("should return true when the default branch matches", async() => {
    const filter = defaultBranchIs("main");
    const result = await filter.test(makeCtx({ defaultBranch: "main" }));

    assert.equal(result, true);
  });

  it("should return false when the default branch does not match", async() => {
    const filter = defaultBranchIs("main");
    const result = await filter.test(makeCtx({ defaultBranch: "master" }));

    assert.equal(result, false);
  });

  it("should match exactly", async() => {
    const filter = defaultBranchIs("develop");
    const result = await filter.test(makeCtx({ defaultBranch: "develop" }));

    assert.equal(result, true);
  });
});
