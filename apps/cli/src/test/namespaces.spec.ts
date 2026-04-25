// Import Node.js Dependencies
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Namespace } from "@rezzou/core";

// CONSTANTS
const kFakeNamespaces: Namespace[] = [
  { id: "1", name: "myorg", displayName: "My Org", type: "org", provider: "github" },
  { id: "2", name: "testuser", displayName: "Test User", type: "user", provider: "github" }
];

const mockListNamespaces = mock.fn(async() => kFakeNamespaces);
const mockCreateAdapter = mock.fn(() => {
  return { listNamespaces: mockListNamespaces };
});

mock.module("../adapter.ts", {
  namedExports: { createAdapter: mockCreateAdapter }
});

const { namespacesCommand } = await import("../commands/namespaces.ts");

describe("UT namespacesCommand", () => {
  beforeEach(() => {
    mockListNamespaces.mock.resetCalls();
    mockCreateAdapter.mock.resetCalls();
  });

  it("should show usage when no provider is given", async(testCtx) => {
    const consoleLog = testCtx.mock.method(console, "log");
    await namespacesCommand([]);

    assert.equal(consoleLog.mock.callCount(), 1);
    assert.match(String(consoleLog.mock.calls[0].arguments[0]), /Usage: rezzou namespaces/);
  });

  it("should show usage with --help", async(testCtx) => {
    const consoleLog = testCtx.mock.method(console, "log");
    await namespacesCommand(["--help"]);

    assert.equal(consoleLog.mock.callCount(), 1);
    assert.match(String(consoleLog.mock.calls[0].arguments[0]), /Usage: rezzou namespaces/);
  });

  it("should call createAdapter with the given provider", async(testCtx) => {
    testCtx.mock.method(console, "log");
    await namespacesCommand(["github"]);

    assert.equal(mockCreateAdapter.mock.callCount(), 1);
    assert.deepEqual(mockCreateAdapter.mock.calls[0].arguments, ["github"]);
  });

  it("should list namespaces with correct format", async(testCtx) => {
    const consoleLog = testCtx.mock.method(console, "log");
    await namespacesCommand(["github"]);

    assert.equal(consoleLog.mock.callCount(), 2);
    assert.equal(consoleLog.mock.calls[0].arguments[0], "My Org (org) — 1");
    assert.equal(consoleLog.mock.calls[1].arguments[0], "Test User (user) — 2");
  });
});
