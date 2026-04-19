
// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ApiRepoContext } from "../context.ts";
import type { Repo, ProviderAdapter } from "../types.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

function makeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    provider: "gitlab",
    listNamespaces: async() => [],
    listRepos: async() => [],
    getFile: async() => null,
    listTree: async() => [],
    submitChanges: async() => {
      return { prUrl: "", prTitle: "" };
    },
    listMembers: async() => [],
    ...overrides
  };
}

describe("ApiRepoContext.readFile", () => {
  it("should return null when adapter returns null", async() => {
    const ctx = new ApiRepoContext(makeAdapter(), kRepo);
    const result = await ctx.readFile("missing.txt");

    assert.equal(result, null);
  });

  it("should return file content from adapter", async() => {
    const adapter = makeAdapter({
      getFile: async() => {
        return { content: "hello world", ref: "main" };
      }
    });
    const ctx = new ApiRepoContext(adapter, kRepo);
    const result = await ctx.readFile("README.md");

    assert.equal(result, "hello world");
  });

  it("should call adapter with repo fullPath, filePath and defaultBranch", async() => {
    let capturedArgs: [string, string, string] | undefined;
    const adapter = makeAdapter({
      getFile: async(repoPath, filePath, branch) => {
        capturedArgs = [repoPath, filePath, branch];

        return null;
      }
    });
    const ctx = new ApiRepoContext(adapter, kRepo);
    await ctx.readFile("package.json");

    assert.deepEqual(capturedArgs, [kRepo.fullPath, "package.json", kRepo.defaultBranch]);
  });

  it("should cache file content and not call adapter twice for same path", async() => {
    let callCount = 0;
    const adapter = makeAdapter({
      getFile: async() => {
        callCount++;

        return { content: "cached", ref: "main" };
      }
    });
    const ctx = new ApiRepoContext(adapter, kRepo);

    const first = await ctx.readFile("file.ts");
    const second = await ctx.readFile("file.ts");

    assert.equal(first, "cached");
    assert.equal(second, "cached");
    assert.equal(callCount, 1);
  });

  it("should cache null results and not call adapter again", async() => {
    let callCount = 0;
    const adapter = makeAdapter({
      getFile: async() => {
        callCount++;

        return null;
      }
    });
    const ctx = new ApiRepoContext(adapter, kRepo);

    await ctx.readFile("absent.txt");
    await ctx.readFile("absent.txt");

    assert.equal(callCount, 1);
  });
});

describe("ApiRepoContext.listFiles", () => {
  it("should return all files when glob matches all", async() => {
    const adapter = makeAdapter({ listTree: async() => ["a.ts", "b.ts", "README.md"] });
    const ctx = new ApiRepoContext(adapter, kRepo);

    const result = await ctx.listFiles("**/*");

    assert.deepEqual(result, ["a.ts", "b.ts", "README.md"]);
  });

  it("should filter files by glob pattern", async() => {
    const adapter = makeAdapter({ listTree: async() => ["src/index.ts", "src/utils.ts", "README.md", "package.json"] });
    const ctx = new ApiRepoContext(adapter, kRepo);

    const result = await ctx.listFiles("src/**/*.ts");

    assert.deepEqual(result, ["src/index.ts", "src/utils.ts"]);
  });

  it("should return empty array when no files match glob", async() => {
    const adapter = makeAdapter({ listTree: async() => ["README.md", "package.json"] });
    const ctx = new ApiRepoContext(adapter, kRepo);

    const result = await ctx.listFiles("**/*.ts");

    assert.deepEqual(result, []);
  });

  it("should call listTree with repo fullPath and defaultBranch", async() => {
    let capturedArgs: [string, string] | undefined;
    const adapter = makeAdapter({
      listTree: async(repoPath, branch) => {
        capturedArgs = [repoPath, branch];

        return [];
      }
    });
    const ctx = new ApiRepoContext(adapter, kRepo);
    await ctx.listFiles("**/*");

    assert.deepEqual(capturedArgs, [kRepo.fullPath, kRepo.defaultBranch]);
  });

  it("should cache the tree and not call listTree twice", async() => {
    let callCount = 0;
    const adapter = makeAdapter({
      listTree: async() => {
        callCount++;

        return ["a.ts"];
      }
    });
    const ctx = new ApiRepoContext(adapter, kRepo);

    await ctx.listFiles("**/*.ts");
    await ctx.listFiles("**/*.ts");

    assert.equal(callCount, 1);
  });
});

describe("ApiRepoContext.exists", () => {
  it("should return false when file is not in tree cache", async() => {
    const adapter = makeAdapter({ listTree: async() => ["a.ts", "b.ts"] });
    const ctx = new ApiRepoContext(adapter, kRepo);

    await ctx.listFiles("**/*");
    const result = await ctx.exists("c.ts");

    assert.equal(result, false);
  });

  it("should return true when file is in tree cache", async() => {
    const adapter = makeAdapter({ listTree: async() => ["src/index.ts", "README.md"] });
    const ctx = new ApiRepoContext(adapter, kRepo);

    await ctx.listFiles("**/*");
    const result = await ctx.exists("src/index.ts");

    assert.equal(result, true);
  });

  it("should fall back to readFile when tree is not loaded", async() => {
    const adapter = makeAdapter({
      getFile: async(_repo, filePath) => (filePath === "found.txt" ? { content: "x", ref: "main" } : null)
    });
    const ctx = new ApiRepoContext(adapter, kRepo);

    assert.equal(await ctx.exists("found.txt"), true);
    assert.equal(await ctx.exists("missing.txt"), false);
  });
});
