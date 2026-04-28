// Import Node.js Dependencies
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

// Import Internal Dependencies
import { getSubfolderEntry } from "../plugin-store.ts";

describe("getSubfolderEntry", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rezzou-plugin-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return index.ts when present", () => {
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "");

    assert.equal(getSubfolderEntry(tmpDir), path.join(tmpDir, "index.ts"));
  });

  it("should prefer index.ts over index.mjs and index.js", () => {
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "");
    fs.writeFileSync(path.join(tmpDir, "index.mjs"), "");
    fs.writeFileSync(path.join(tmpDir, "index.js"), "");

    assert.equal(getSubfolderEntry(tmpDir), path.join(tmpDir, "index.ts"));
  });

  it("should prefer index.mjs over index.js", () => {
    fs.writeFileSync(path.join(tmpDir, "index.mjs"), "");
    fs.writeFileSync(path.join(tmpDir, "index.js"), "");

    assert.equal(getSubfolderEntry(tmpDir), path.join(tmpDir, "index.mjs"));
  });

  it("should resolve package.json#main", () => {
    fs.mkdirSync(path.join(tmpDir, "dist"));
    fs.writeFileSync(path.join(tmpDir, "dist", "index.js"), "");
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ main: "dist/index.js" }));

    assert.equal(getSubfolderEntry(tmpDir), path.join(tmpDir, "dist", "index.js"));
  });

  it("should prefer package.json#rezzou.entry over main", () => {
    fs.mkdirSync(path.join(tmpDir, "dist"));
    fs.writeFileSync(path.join(tmpDir, "dist", "index.js"), "");
    fs.writeFileSync(path.join(tmpDir, "dist", "plugin.js"), "");
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      main: "dist/index.js",
      rezzou: { entry: "dist/plugin.js" }
    }));

    assert.equal(getSubfolderEntry(tmpDir), path.join(tmpDir, "dist", "plugin.js"));
  });

  it("should prefer package.json#rezzou.entry over index.ts", () => {
    fs.mkdirSync(path.join(tmpDir, "dist"));
    fs.writeFileSync(path.join(tmpDir, "dist", "plugin.js"), "");
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "");
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      rezzou: { entry: "dist/plugin.js" }
    }));

    assert.equal(getSubfolderEntry(tmpDir), path.join(tmpDir, "dist", "plugin.js"));
  });

  it("should throw when package.json has no main or rezzou.entry", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "my-plugin", version: "1.0.0" }));

    assert.throws(
      () => getSubfolderEntry(tmpDir),
      (err: unknown) => err instanceof Error && err.message.includes("package.json")
    );
  });

  it("should return null when directory has no recognizable entry", () => {
    assert.equal(getSubfolderEntry(tmpDir), null);
  });

  it("should return null when package.json#main file does not exist", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ main: "dist/index.js" }));

    assert.equal(getSubfolderEntry(tmpDir), null);
  });

  it("should return null when package.json#rezzou.entry file does not exist", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ rezzou: { entry: "dist/plugin.js" } }));

    assert.equal(getSubfolderEntry(tmpDir), null);
  });

  it("should return null when package.json is not valid JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "not-json");

    assert.equal(getSubfolderEntry(tmpDir), null);
  });
});
