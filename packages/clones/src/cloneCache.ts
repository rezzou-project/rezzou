// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as cp from "node:child_process";
import { promisify } from "node:util";

// Import Third-party Dependencies
import type { Repo } from "@rezzou/core";

// CONSTANTS
const kDefaultBaseDir = path.join(os.homedir(), ".rezzou", "clones");
const kDefaultMaxSizeMb = 5120;
const kDefaultTtlDays = 30;
const kGitTimeoutMs = 120_000;

export interface CloneHandle {
  path: string;
}

export interface CloneEntry {
  path: string;
  lastUsed: string;
  sizeMb: number;
}

export interface CloneCacheOptions {
  baseDir?: string;
  maxSizeMb?: number;
  ttlDays?: number;
}

interface MetaEntry {
  lastUsed: string;
  sizeMb: number;
}

interface MetaJson {
  [clonePath: string]: MetaEntry;
}

const kExecFile = promisify(cp.execFile);

async function execFileAsync(file: string, args: string[]): Promise<void> {
  await kExecFile(file, args, { timeout: kGitTimeoutMs });
}

async function getDirSizeMb(dirPath: string): Promise<number> {
  if (process.platform !== "win32") {
    const { promise, resolve } = Promise.withResolvers<number>();
    cp.execFile("du", ["-sk", dirPath], { timeout: kGitTimeoutMs }, (_err, stdout) => {
      const kb = parseInt((stdout ?? "").trim().split(/\s+/)[0], 10);
      resolve(Number.isNaN(kb) ? NaN : Math.round((kb / 1024) * 10) / 10);
    });

    const mbFromDu = await promise;
    if (!Number.isNaN(mbFromDu)) {
      return mbFromDu;
    }
  }

  let totalBytes = 0;

  try {
    const entries = await fs.readdir(dirPath, { recursive: true });

    for (const entry of entries) {
      try {
        const stat = await fs.stat(path.join(dirPath, entry.toString()));
        if (stat.isFile()) {
          totalBytes += stat.size;
        }
      }
      catch {
        // ignore
      }
    }
  }
  catch {
    // directory does not exist or is unreadable
  }

  return Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
}

export class CloneCache {
  readonly #provider: string;
  readonly #baseDir: string;
  readonly #metaFile: string;
  readonly #maxSizeMb: number;
  readonly #ttlDays: number;
  readonly #pending = new Map<string, Promise<CloneHandle>>();

  constructor(provider: string, options?: CloneCacheOptions) {
    this.#provider = provider;
    this.#baseDir = options?.baseDir ?? kDefaultBaseDir;
    this.#metaFile = path.join(this.#baseDir, ".meta.json");
    this.#maxSizeMb = options?.maxSizeMb ?? kDefaultMaxSizeMb;
    this.#ttlDays = options?.ttlDays ?? kDefaultTtlDays;
  }

  #clonePath(repo: Repo): string {
    return path.join(this.#baseDir, this.#provider, repo.fullPath);
  }

  async #readMeta(): Promise<MetaJson> {
    try {
      const content = await fs.readFile(this.#metaFile, "utf-8");

      return JSON.parse(content) as MetaJson;
    }
    catch {
      return {};
    }
  }

  async #writeMeta(meta: MetaJson): Promise<void> {
    await fs.mkdir(this.#baseDir, { recursive: true });
    await fs.writeFile(this.#metaFile, JSON.stringify(meta, null, 2));
  }

  async #updateMeta(clonePath: string): Promise<void> {
    const [meta, sizeMb] = await Promise.all([this.#readMeta(), getDirSizeMb(clonePath)]);
    meta[clonePath] = { lastUsed: new Date().toISOString(), sizeMb };
    await this.#writeMeta(meta);
  }

  async prune(): Promise<void> {
    const meta = await this.#readMeta();
    const now = Date.now();
    const ttlMs = this.#ttlDays * 24 * 60 * 60 * 1000;
    let changed = false;

    for (const [clonePath, entry] of Object.entries(meta)) {
      const age = now - new Date(entry.lastUsed).getTime();
      if (age > ttlMs) {
        await fs.rm(clonePath, { recursive: true, force: true });
        delete meta[clonePath];
        changed = true;
      }
    }

    const remaining = Object.entries(meta);
    const totalMb = remaining.reduce((sum, [, e]) => sum + e.sizeMb, 0);

    if (totalMb > this.#maxSizeMb) {
      remaining.sort(([, a], [, b]) => new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime());

      let currentMb = totalMb;
      for (const [clonePath, entry] of remaining) {
        if (currentMb <= this.#maxSizeMb) {
          break;
        }
        await fs.rm(clonePath, { recursive: true, force: true });
        currentMb -= entry.sizeMb;
        delete meta[clonePath];
        changed = true;
      }
    }

    if (changed) {
      await this.#writeMeta(meta);
    }
  }

  async #doEnsure(repo: Repo): Promise<CloneHandle> {
    await this.prune();

    const clonePath = this.#clonePath(repo);

    let cloneExists: boolean;
    try {
      const stat = await fs.stat(clonePath);
      cloneExists = stat.isDirectory();
    }
    catch {
      cloneExists = false;
    }

    if (cloneExists) {
      try {
        await execFileAsync("git", ["-C", clonePath, "fetch", "--all", "--prune"]);
      }
      catch (error) {
        throw new Error("failed to fetch repository", { cause: error });
      }

      try {
        await execFileAsync("git", ["-C", clonePath, "checkout", repo.defaultBranch]);
      }
      catch (error) {
        throw new Error(`failed to checkout branch "${repo.defaultBranch}"`, { cause: error });
      }

      try {
        await execFileAsync("git", ["-C", clonePath, "reset", "--hard", `origin/${repo.defaultBranch}`]);
      }
      catch (error) {
        throw new Error("failed to reset to origin", { cause: error });
      }
    }
    else {
      await fs.mkdir(path.dirname(clonePath), { recursive: true });

      try {
        await execFileAsync("git", ["clone", repo.url, clonePath]);
      }
      catch (error) {
        try {
          await fs.rm(clonePath, { recursive: true, force: true });
        }
        catch {
          // ignore
        }

        throw new Error("failed to clone repository", { cause: error });
      }
    }

    await this.#updateMeta(clonePath);

    return { path: clonePath };
  }

  ensure(repo: Repo): Promise<CloneHandle> {
    const clonePath = this.#clonePath(repo);
    const existing = this.#pending.get(clonePath);
    if (existing) {
      return existing;
    }

    const promise = this.#doEnsure(repo);
    this.#pending.set(clonePath, promise);
    const cleanup = () => {
      this.#pending.delete(clonePath);
    };
    promise.then(cleanup, cleanup);

    return promise;
  }

  async reset(repo: Repo): Promise<void> {
    const clonePath = this.#clonePath(repo);

    let cloneExists: boolean;
    try {
      const stat = await fs.stat(clonePath);
      cloneExists = stat.isDirectory();
    }
    catch {
      cloneExists = false;
    }

    if (!cloneExists) {
      throw new Error(`no clone found for repository "${repo.fullPath}"`);
    }

    try {
      await execFileAsync("git", ["-C", clonePath, "fetch", "--all", "--prune"]);
    }
    catch (error) {
      throw new Error("failed to fetch repository", { cause: error });
    }

    try {
      await execFileAsync("git", ["-C", clonePath, "reset", "--hard", `origin/${repo.defaultBranch}`]);
    }
    catch (error) {
      throw new Error("failed to reset to origin", { cause: error });
    }

    try {
      await execFileAsync("git", ["-C", clonePath, "clean", "-fdx"]);
    }
    catch (error) {
      throw new Error("failed to clean working tree", { cause: error });
    }

    await this.#updateMeta(clonePath);
  }

  async remove(repo: Repo): Promise<void> {
    const clonePath = this.#clonePath(repo);

    await fs.rm(clonePath, { recursive: true, force: true });

    const meta = await this.#readMeta();
    delete meta[clonePath];
    await this.#writeMeta(meta);
  }

  async list(): Promise<CloneEntry[]> {
    const meta = await this.#readMeta();

    return Object.entries(meta).map(([entryPath, data]) => {
      return { path: entryPath, lastUsed: data.lastUsed, sizeMb: data.sizeMb };
    });
  }
}
