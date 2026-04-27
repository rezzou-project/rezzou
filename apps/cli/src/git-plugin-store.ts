// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as cp from "node:child_process";

// CONSTANTS
const kRezzouDir = path.join(os.homedir(), ".rezzou");
const kGitPluginsDir = path.join(kRezzouDir, "plugins-git");
const kGitPluginsFile = path.join(kRezzouDir, "plugins-git.json");
const kGitCloneTimeoutMs = 60_000;

export interface GitPluginEntry {
  slug: string;
  url: string;
  ref: string | null;
  pinnedCommit: string;
  installedAt: string;
}

export interface ParsedGitUrl {
  cloneUrl: string;
  ref: string | null;
  slug: string;
}

export function isGitUrl(raw: string): boolean {
  return (
    raw.startsWith("git+https://") ||
    raw.startsWith("git+ssh://") ||
    raw.startsWith("git@") ||
    /^https?:\/\/(github|gitlab)\.com\//.test(raw)
  );
}

export function parseGitUrl(raw: string): ParsedGitUrl | null {
  const hashIdx = raw.lastIndexOf("#");
  const protocolIdx = raw.indexOf("://");

  let urlPart = raw;
  let ref: string | null = null;

  if (hashIdx !== -1 && hashIdx > protocolIdx) {
    const candidate = raw.slice(hashIdx + 1);
    if (candidate) {
      ref = candidate;
      urlPart = raw.slice(0, hashIdx);
    }
  }

  let cloneUrl = urlPart;
  if (cloneUrl.startsWith("git+")) {
    cloneUrl = cloneUrl.slice(4);
  }

  const slugBase = cloneUrl
    .replace(/^https?:\/\//, "")
    .replace(/^ssh:\/\//, "")
    .replace(/^git@/, "")
    .replace(/^([^:/]+):/, "$1/")
    .replace(/\.git$/, "");

  const slug = slugBase.replace(/\//g, "-");

  if (!slug) {
    return null;
  }

  return { cloneUrl, ref, slug };
}

export function gitPluginPath(slug: string): string {
  return path.join(kGitPluginsDir, slug);
}

export function readGitPlugins(): GitPluginEntry[] {
  if (!fs.existsSync(kGitPluginsFile)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(kGitPluginsFile, "utf-8")) as GitPluginEntry[];
  }
  catch {
    return [];
  }
}

export function addGitPluginEntry(entry: GitPluginEntry): void {
  const entries = readGitPlugins();
  const idx = entries.findIndex((existingEntry) => existingEntry.slug === entry.slug);

  if (idx === -1) {
    entries.push(entry);
  }
  else {
    entries[idx] = entry;
  }

  fs.mkdirSync(kRezzouDir, { recursive: true });
  fs.writeFileSync(kGitPluginsFile, JSON.stringify(entries, null, 2));
}

function execFileAsync(file: string, args: string[], timeoutMs: number): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  cp.execFile(file, args, { timeout: timeoutMs }, (error) => {
    if (error) {
      reject(error);

      return;
    }

    resolve();
  });

  return promise;
}

function execFileAsyncOut(file: string, args: string[], timeoutMs: number): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();

  cp.execFile(file, args, { timeout: timeoutMs }, (error, stdout) => {
    if (error) {
      reject(error);

      return;
    }

    resolve(stdout.trim());
  });

  return promise;
}

export async function resolveCommitHash(targetPath: string): Promise<string> {
  return execFileAsyncOut("git", ["-C", targetPath, "rev-parse", "HEAD"], kGitCloneTimeoutMs);
}

export async function cloneGitPlugin(
  cloneUrl: string,
  targetPath: string,
  ref: string | null
): Promise<void> {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  try {
    await execFileAsync("git", ["clone", cloneUrl, targetPath], kGitCloneTimeoutMs);
  }
  catch (error) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
    catch {
      // ignore
    }

    throw new Error("failed to clone git repository", { cause: error });
  }

  if (!ref) {
    return;
  }

  try {
    await execFileAsync("git", ["-C", targetPath, "checkout", ref], kGitCloneTimeoutMs);
  }
  catch (error) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
    catch {
      // ignore
    }

    throw new Error(`failed to checkout ref "${ref}"`, { cause: error });
  }
}
