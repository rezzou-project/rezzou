// Import Node.js Dependencies
import { describe, it, mock, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

// CONSTANTS
const kTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rezzou-clone-test-"));

interface ExecResult {
  error?: Error;
  stdout?: string;
}

type ExecCallback = (error: Error | null, stdout?: string) => void;

let execQueue: ExecResult[] = [];

// eslint-disable-next-line max-params
const fakeExecFile = mock.fn(function execFileMock(
  _file: string,
  _args: string[],
  _opts: unknown,
  callback: ExecCallback
) {
  const result = execQueue.shift();
  process.nextTick(() => callback(result?.error ?? null, result?.stdout));
});

mock.module("node:child_process", {
  namedExports: { execFile: fakeExecFile }
});

const { cloneGitPlugin, fetchGitPlugin } = await import("../git-plugin-store.ts");

after(() => {
  fs.rmSync(kTmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  execQueue = [];
  fakeExecFile.mock.resetCalls();
});

describe("UT cloneGitPlugin", () => {
  it("should clone without error when no ref is provided", async() => {
    const targetPath = path.join(kTmpDir, "no-ref");
    execQueue.push({});

    await assert.doesNotReject(() => cloneGitPlugin("https://github.com/example/plugin", targetPath, { ref: null }));

    assert.equal(fakeExecFile.mock.callCount(), 1);
    const call = fakeExecFile.mock.calls[0];
    assert.equal(call.arguments[0], "git");
    assert.deepEqual(call.arguments[1], ["clone", "https://github.com/example/plugin", targetPath]);
  });

  it("should call checkout after cloning when a ref is provided", async() => {
    const targetPath = path.join(kTmpDir, "with-ref");
    execQueue.push({});
    execQueue.push({});

    await cloneGitPlugin("https://github.com/example/plugin", targetPath, { ref: "v1.0.0" });

    assert.equal(fakeExecFile.mock.callCount(), 2);
    const checkoutCall = fakeExecFile.mock.calls[1];
    assert.equal(checkoutCall.arguments[0], "git");
    assert.deepEqual(checkoutCall.arguments[1], ["-C", targetPath, "checkout", "v1.0.0"]);
  });

  it("should remove the target directory and throw when clone fails", async() => {
    const targetPath = path.join(kTmpDir, "clone-fail");
    fs.mkdirSync(targetPath, { recursive: true });
    execQueue.push({ error: new Error("connection refused") });

    await assert.rejects(
      () => cloneGitPlugin("https://github.com/example/plugin", targetPath, { ref: null }),
      { message: "failed to clone git repository" }
    );

    assert.equal(fs.existsSync(targetPath), false);
  });

  it("should remove the target directory and throw when checkout fails", async() => {
    const targetPath = path.join(kTmpDir, "checkout-fail");
    fs.mkdirSync(targetPath, { recursive: true });
    execQueue.push({});
    execQueue.push({ error: new Error("ref not found") });

    await assert.rejects(
      () => cloneGitPlugin("https://github.com/example/plugin", targetPath, { ref: "v2.0.0" }),
      { message: "failed to checkout ref \"v2.0.0\"" }
    );

    assert.equal(fs.existsSync(targetPath), false);
  });

  it("should pass the custom timeoutMs to execFile", async() => {
    const targetPath = path.join(kTmpDir, "custom-timeout");
    execQueue.push({});

    await cloneGitPlugin("https://github.com/example/plugin", targetPath, { ref: null, timeoutMs: 5_000 });

    const opts = fakeExecFile.mock.calls[0].arguments[2] as { timeout: number; };
    assert.equal(opts.timeout, 5_000);
  });

  it("should default to 60 seconds when no timeoutMs is provided", async() => {
    const targetPath = path.join(kTmpDir, "default-timeout");
    execQueue.push({});

    await cloneGitPlugin("https://github.com/example/plugin", targetPath, { ref: null });

    const opts = fakeExecFile.mock.calls[0].arguments[2] as { timeout: number; };
    assert.equal(opts.timeout, 60_000);
  });
});

describe("UT fetchGitPlugin", () => {
  it("should fetch and pull without checkout when no ref is provided", async() => {
    const targetPath = path.join(kTmpDir, "fetch-no-ref");
    execQueue.push({});
    execQueue.push({});

    await fetchGitPlugin(targetPath, null);

    assert.equal(fakeExecFile.mock.callCount(), 2);
    assert.deepEqual(fakeExecFile.mock.calls[0].arguments[1], ["-C", targetPath, "fetch", "--all", "--prune"]);
    assert.deepEqual(fakeExecFile.mock.calls[1].arguments[1], ["-C", targetPath, "pull", "--ff-only"]);
  });

  it("should fetch, checkout, and pull when a ref is provided", async() => {
    const targetPath = path.join(kTmpDir, "fetch-with-ref");
    execQueue.push({});
    execQueue.push({});
    execQueue.push({});

    await fetchGitPlugin(targetPath, "v2.0.0");

    assert.equal(fakeExecFile.mock.callCount(), 3);
    assert.deepEqual(fakeExecFile.mock.calls[1].arguments[1], ["-C", targetPath, "checkout", "v2.0.0"]);
    assert.deepEqual(fakeExecFile.mock.calls[2].arguments[1], ["-C", targetPath, "pull", "--ff-only"]);
  });

  it("should throw when fetch fails", async() => {
    const targetPath = path.join(kTmpDir, "fetch-fail");
    execQueue.push({ error: new Error("network unreachable") });

    await assert.rejects(
      () => fetchGitPlugin(targetPath, null),
      { message: "failed to fetch git repository" }
    );
  });

  it("should throw when checkout fails", async() => {
    const targetPath = path.join(kTmpDir, "checkout-fail-fetch");
    execQueue.push({});
    execQueue.push({ error: new Error("ref not found") });

    await assert.rejects(
      () => fetchGitPlugin(targetPath, "v99.0.0"),
      { message: "failed to checkout ref \"v99.0.0\"" }
    );
  });

  it("should throw when pull fails", async() => {
    const targetPath = path.join(kTmpDir, "pull-fail");
    execQueue.push({});
    execQueue.push({ error: new Error("not a fast-forward") });

    await assert.rejects(
      () => fetchGitPlugin(targetPath, null),
      { message: "failed to pull with --ff-only" }
    );
  });

  it("should pass custom timeoutMs to execFile", async() => {
    const targetPath = path.join(kTmpDir, "fetch-custom-timeout");
    execQueue.push({});
    execQueue.push({});

    await fetchGitPlugin(targetPath, null, { timeoutMs: 5_000 });

    const opts = fakeExecFile.mock.calls[0].arguments[2] as { timeout: number; };
    assert.equal(opts.timeout, 5_000);
  });
});
