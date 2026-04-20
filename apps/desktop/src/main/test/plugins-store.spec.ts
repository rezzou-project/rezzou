// Import Node.js Dependencies
import { describe, it, mock, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

// CONSTANTS
const kTmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "rezzou-test-"));
const kPluginsDir = path.join(kTmpHome, ".rezzou");
const kPluginsFile = path.join(kPluginsDir, "plugins.json");

mock.module("node:os", {
  namedExports: {
    homedir: () => kTmpHome
  }
});

const { readPluginPaths, addPluginPath } = await import("../plugins-store.ts");

after(() => {
  fs.rmSync(kTmpHome, { recursive: true, force: true });
});

describe("readPluginPaths", () => {
  beforeEach(() => {
    fs.rmSync(kPluginsDir, { recursive: true, force: true });
  });

  it("should return an empty array when the file does not exist", () => {
    const result = readPluginPaths();

    assert.deepEqual(result, []);
  });

  it("should return the stored paths", () => {
    fs.mkdirSync(kPluginsDir, { recursive: true });
    fs.writeFileSync(kPluginsFile, JSON.stringify(["/foo/bar.ts", "/baz/qux.js"]));

    const result = readPluginPaths();

    assert.deepEqual(result, ["/foo/bar.ts", "/baz/qux.js"]);
  });

  it("should return an empty array when the file contains invalid JSON", () => {
    fs.mkdirSync(kPluginsDir, { recursive: true });
    fs.writeFileSync(kPluginsFile, "not-json");

    const result = readPluginPaths();

    assert.deepEqual(result, []);
  });
});

describe("addPluginPath", () => {
  beforeEach(() => {
    fs.rmSync(kPluginsDir, { recursive: true, force: true });
  });

  it("should create the directory and file when they do not exist", () => {
    addPluginPath("/foo/plugin.ts");

    assert.ok(fs.existsSync(kPluginsFile));
    assert.deepEqual(readPluginPaths(), ["/foo/plugin.ts"]);
  });

  it("should append a new path to the existing list", () => {
    addPluginPath("/foo/plugin.ts");
    addPluginPath("/bar/plugin.ts");

    assert.deepEqual(readPluginPaths(), ["/foo/plugin.ts", "/bar/plugin.ts"]);
  });

  it("should not add a duplicate path", () => {
    addPluginPath("/foo/plugin.ts");
    addPluginPath("/foo/plugin.ts");

    assert.deepEqual(readPluginPaths(), ["/foo/plugin.ts"]);
  });
});
