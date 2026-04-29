// Import Node.js Dependencies
import { describe, it, mock, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";

// Import Third-party Dependencies
import type { Repo } from "@rezzou/core";

// CONSTANTS
const kTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rezzou-clone-cache-test-"));
const kProvider = "github";
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://github.com/ns/my-repo"
};

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

const { CloneCache } = await import("../cloneCache.ts");

after(() => {
  fs.rmSync(kTmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  execQueue = [];
  fakeExecFile.mock.resetCalls();
});

function makeCache() {
  return new CloneCache(kProvider, { baseDir: kTmpDir });
}

function clonePath(repo: Repo) {
  return path.join(kTmpDir, kProvider, repo.fullPath);
}

describe("CloneCache", () => {
  describe("ensure", () => {
    it("should clone the repo when not already present", async() => {
      execQueue.push({});
      execQueue.push({ stdout: "0\t" });

      const handle = await makeCache().ensure(kRepo);

      assert.equal(handle.path, clonePath(kRepo));
      assert.equal(fakeExecFile.mock.callCount(), 2);

      const [file, args] = fakeExecFile.mock.calls[0].arguments;
      assert.equal(file, "git");
      assert.deepEqual(args, ["clone", kRepo.url, clonePath(kRepo)]);
    });

    it("should write a meta entry after cloning", async() => {
      const cache = makeCache();
      execQueue.push({});
      execQueue.push({ stdout: "0\t" });

      await cache.ensure(kRepo);

      const entries = await cache.list();
      const entry = entries.find((e) => e.path === clonePath(kRepo));
      assert.ok(entry !== undefined);
      assert.ok(typeof entry.lastUsed === "string");
      assert.ok(typeof entry.sizeMb === "number");
    });

    it("should fetch, checkout and reset when clone already exists", async() => {
      await fsPromises.mkdir(clonePath(kRepo), { recursive: true });
      execQueue.push({});
      execQueue.push({});
      execQueue.push({});
      execQueue.push({ stdout: "0\t" });

      const handle = await makeCache().ensure(kRepo);

      assert.equal(handle.path, clonePath(kRepo));
      assert.equal(fakeExecFile.mock.callCount(), 4);

      const calls = fakeExecFile.mock.calls.map((c) => c.arguments[1]);
      assert.deepEqual(calls[0], ["-C", clonePath(kRepo), "fetch", "--all", "--prune"]);
      assert.deepEqual(calls[1], ["-C", clonePath(kRepo), "checkout", kRepo.defaultBranch]);
      assert.deepEqual(calls[2], ["-C", clonePath(kRepo), "reset", "--hard", `origin/${kRepo.defaultBranch}`]);
    });

    it("should return the same promise for concurrent calls on the same repo", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/concurrent-repo", name: "concurrent-repo" };
      execQueue.push({});
      execQueue.push({ stdout: "0\t" });

      const cache = makeCache();
      const p1 = cache.ensure(repo);
      const p2 = cache.ensure(repo);

      assert.strictEqual(p1, p2);

      await p1;

      assert.equal(fakeExecFile.mock.callCount(), 2);
    });

    it("should allow a new ensure after the first one resolves", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/rebatch-repo", name: "rebatch-repo" };
      const cache = makeCache();

      execQueue.push({});
      execQueue.push({ stdout: "0\t" });
      await cache.ensure(repo);

      await fsPromises.mkdir(clonePath(repo), { recursive: true });

      execQueue.push({});
      execQueue.push({});
      execQueue.push({});
      execQueue.push({ stdout: "0\t" });
      await cache.ensure(repo);

      assert.equal(fakeExecFile.mock.callCount(), 6);
    });

    it("should throw and clean up directory when clone fails", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/clone-fail-repo", name: "clone-fail-repo" };
      execQueue.push({ error: new Error("network unreachable") });

      await assert.rejects(
        () => makeCache().ensure(repo),
        { message: "failed to clone repository" }
      );
    });
  });

  describe("reset", () => {
    it("should throw when the clone does not exist", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/missing-repo", name: "missing-repo" };

      await assert.rejects(
        () => makeCache().reset(repo),
        { message: `no clone found for repository "${repo.fullPath}"` }
      );
    });

    it("should fetch, reset and clean an existing clone", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/reset-repo", name: "reset-repo" };
      await fsPromises.mkdir(clonePath(repo), { recursive: true });

      execQueue.push({});
      execQueue.push({});
      execQueue.push({});
      execQueue.push({ stdout: "0\t" });

      await makeCache().reset(repo);

      assert.equal(fakeExecFile.mock.callCount(), 4);

      const calls = fakeExecFile.mock.calls.map((c) => c.arguments[1]);
      assert.deepEqual(calls[0], ["-C", clonePath(repo), "fetch", "--all", "--prune"]);
      assert.deepEqual(calls[1], ["-C", clonePath(repo), "reset", "--hard", `origin/${repo.defaultBranch}`]);
      assert.deepEqual(calls[2], ["-C", clonePath(repo), "clean", "-fdx"]);
    });

    it("should throw when fetch fails", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/reset-fetch-fail", name: "reset-fetch-fail" };
      await fsPromises.mkdir(clonePath(repo), { recursive: true });

      execQueue.push({ error: new Error("network error") });

      await assert.rejects(
        () => makeCache().reset(repo),
        { message: "failed to fetch repository" }
      );
    });

    it("should throw when clean fails", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/reset-clean-fail", name: "reset-clean-fail" };
      await fsPromises.mkdir(clonePath(repo), { recursive: true });

      execQueue.push({});
      execQueue.push({});
      execQueue.push({ error: new Error("permission denied") });

      await assert.rejects(
        () => makeCache().reset(repo),
        { message: "failed to clean working tree" }
      );
    });
  });

  describe("remove", () => {
    it("should remove the clone directory and its meta entry", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/remove-repo", name: "remove-repo" };
      const repoPath = clonePath(repo);
      await fsPromises.mkdir(repoPath, { recursive: true });

      const cache = makeCache();
      execQueue.push({});
      execQueue.push({ stdout: "0\t" });
      await cache.ensure(repo);

      const beforeEntries = await cache.list();
      assert.ok(beforeEntries.some((e) => e.path === repoPath));

      await cache.remove(repo);

      const afterEntries = await cache.list();
      assert.ok(!afterEntries.some((e) => e.path === repoPath));
      assert.equal(fs.existsSync(repoPath), false);
    });

    it("should not throw when removing a repo that was never cloned", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/never-cloned", name: "never-cloned" };

      await assert.doesNotReject(() => makeCache().remove(repo));
    });
  });

  describe("list", () => {
    it("should return an empty array when no clones have been made", async() => {
      const cache = new CloneCache(kProvider, { baseDir: path.join(kTmpDir, "empty-list") });

      const entries = await cache.list();

      assert.deepEqual(entries, []);
    });

    it("should return entries with path, lastUsed and sizeMb", async() => {
      const repo: Repo = { ...kRepo, fullPath: "ns/list-repo", name: "list-repo" };
      const cache = makeCache();
      execQueue.push({});
      execQueue.push({ stdout: "0\t" });

      await cache.ensure(repo);

      const entries = await cache.list();
      const entry = entries.find((e) => e.path === clonePath(repo));

      assert.ok(entry !== undefined);
      assert.ok(entry.lastUsed.match(/^\d{4}-\d{2}-\d{2}T/));
      assert.ok(entry.sizeMb >= 0);
    });
  });

  describe("prune", () => {
    it("should remove TTL-expired clones and update meta", async() => {
      const baseDir = path.join(kTmpDir, "prune-ttl");
      const cache = new CloneCache(kProvider, { baseDir, ttlDays: 1 });
      const repoPath = path.join(baseDir, kProvider, "ns/ttl-repo");
      await fsPromises.mkdir(repoPath, { recursive: true });

      const metaPath = path.join(baseDir, ".meta.json");
      const oldDate = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString();
      await fsPromises.mkdir(baseDir, { recursive: true });
      await fsPromises.writeFile(metaPath, JSON.stringify({
        [repoPath]: { lastUsed: oldDate, sizeMb: 10 }
      }));

      await cache.prune();

      assert.equal(fs.existsSync(repoPath), false);
      const meta = JSON.parse(await fsPromises.readFile(metaPath, "utf-8"));
      assert.equal(Object.keys(meta).length, 0);
    });

    it("should evict LRU clones when total size exceeds cap", async() => {
      const baseDir = path.join(kTmpDir, "prune-lru");
      const cache = new CloneCache(kProvider, { baseDir, maxSizeMb: 10, ttlDays: 365 });
      const oldPath = path.join(baseDir, "old-clone");
      const newPath = path.join(baseDir, "new-clone");

      await fsPromises.mkdir(oldPath, { recursive: true });
      await fsPromises.mkdir(newPath, { recursive: true });

      const metaPath = path.join(baseDir, ".meta.json");
      const oldDate = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString();
      const newDate = new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)).toISOString();
      await fsPromises.mkdir(baseDir, { recursive: true });
      await fsPromises.writeFile(metaPath, JSON.stringify({
        [oldPath]: { lastUsed: oldDate, sizeMb: 6 },
        [newPath]: { lastUsed: newDate, sizeMb: 6 }
      }));

      await cache.prune();

      assert.equal(fs.existsSync(oldPath), false);
      assert.equal(fs.existsSync(newPath), true);

      const meta = JSON.parse(await fsPromises.readFile(metaPath, "utf-8"));
      assert.equal(Object.keys(meta).length, 1);
      assert.ok(newPath in meta);
    });

    it("should not evict clones within TTL and under cap", async() => {
      const baseDir = path.join(kTmpDir, "prune-noevict");
      const cache = new CloneCache(kProvider, { baseDir, maxSizeMb: 100, ttlDays: 30 });
      const repoPath = path.join(baseDir, "my-clone");

      await fsPromises.mkdir(repoPath, { recursive: true });

      const metaPath = path.join(baseDir, ".meta.json");
      const recentDate = new Date().toISOString();
      await fsPromises.mkdir(baseDir, { recursive: true });
      await fsPromises.writeFile(metaPath, JSON.stringify({
        [repoPath]: { lastUsed: recentDate, sizeMb: 5 }
      }));

      await cache.prune();

      assert.equal(fs.existsSync(repoPath), true);
      const meta = JSON.parse(await fsPromises.readFile(metaPath, "utf-8"));
      assert.ok(repoPath in meta);
    });

    it("should be called automatically before ensure", async() => {
      const baseDir = path.join(kTmpDir, "prune-auto");
      const cache = new CloneCache(kProvider, { baseDir, ttlDays: 0 });

      const staleRepoPath = path.join(baseDir, "stale-clone");
      await fsPromises.mkdir(staleRepoPath, { recursive: true });

      const metaPath = path.join(baseDir, ".meta.json");
      const pastDate = new Date(Date.now() - 1).toISOString();
      await fsPromises.mkdir(baseDir, { recursive: true });
      await fsPromises.writeFile(metaPath, JSON.stringify({
        [staleRepoPath]: { lastUsed: pastDate, sizeMb: 1 }
      }));

      execQueue.push({});
      execQueue.push({ stdout: "0\t" });
      await cache.ensure(kRepo);

      assert.equal(fs.existsSync(staleRepoPath), false);
    });
  });
});
