// Import Node.js Dependencies
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Repo } from "@rezzou/core";

// CONSTANTS
const kFakeRepos: Repo[] = [
  {
    id: "1",
    name: "my-project",
    fullPath: "myorg/my-project",
    defaultBranch: "main",
    url: "https://github.com/myorg/my-project"
  },
  {
    id: "2",
    name: "other-project",
    fullPath: "myorg/other-project",
    defaultBranch: "develop",
    url: "https://github.com/myorg/other-project"
  }
];

const mockListRepos = mock.fn(async() => kFakeRepos);
const mockCreateAdapter = mock.fn(() => {
  return { listRepos: mockListRepos };
});

mock.module("../adapter.ts", {
  namedExports: { createAdapter: mockCreateAdapter }
});

const { reposCommand } = await import("../commands/repos.ts");

describe("UT reposCommand", () => {
  beforeEach(() => {
    mockListRepos.mock.resetCalls();
    mockCreateAdapter.mock.resetCalls();
  });

  it("should show usage when no provider is given", async(testCtx) => {
    const consoleLog = testCtx.mock.method(console, "log");
    await reposCommand([]);

    assert.equal(consoleLog.mock.callCount(), 1);
    assert.match(String(consoleLog.mock.calls[0].arguments[0]), /Usage: rezzou repos/);
  });

  it("should show usage when namespace is missing", async(testCtx) => {
    const consoleLog = testCtx.mock.method(console, "log");
    await reposCommand(["github"]);

    assert.equal(consoleLog.mock.callCount(), 1);
    assert.match(String(consoleLog.mock.calls[0].arguments[0]), /Usage: rezzou repos/);
  });

  it("should show usage with --help", async(testCtx) => {
    const consoleLog = testCtx.mock.method(console, "log");
    await reposCommand(["--help"]);

    assert.equal(consoleLog.mock.callCount(), 1);
    assert.match(String(consoleLog.mock.calls[0].arguments[0]), /Usage: rezzou repos/);
  });

  it("should call createAdapter with the given provider", async(testCtx) => {
    testCtx.mock.method(console, "log");
    await reposCommand(["github", "myorg"]);

    assert.equal(mockCreateAdapter.mock.callCount(), 1);
    assert.deepEqual(mockCreateAdapter.mock.calls[0].arguments, ["github"]);
  });

  it("should call listRepos with the given namespace", async(testCtx) => {
    testCtx.mock.method(console, "log");
    await reposCommand(["github", "myorg"]);

    assert.equal(mockListRepos.mock.callCount(), 1);
    assert.deepEqual(mockListRepos.mock.calls[0].arguments, ["myorg"]);
  });

  it("should list repos with correct format", async(testCtx) => {
    const consoleLog = testCtx.mock.method(console, "log");
    await reposCommand(["github", "myorg"]);

    assert.equal(consoleLog.mock.callCount(), 2);
    assert.equal(consoleLog.mock.calls[0].arguments[0], "myorg/my-project [main] — https://github.com/myorg/my-project");
    assert.equal(consoleLog.mock.calls[1].arguments[0], "myorg/other-project [develop] — https://github.com/myorg/other-project");
  });
});
