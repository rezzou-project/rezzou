// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { confirm } from "@topcli/prompts";

// Import Internal Dependencies
import {
  readPluginPaths,
  scanPluginsDir,
  addPluginPath,
  removePluginPath,
  getSubfolderEntry
} from "../plugin-store.ts";
import {
  isGitUrl,
  parseGitUrl,
  gitPluginPath,
  addGitPluginEntry,
  readGitPlugins,
  cloneGitPlugin,
  fetchGitPlugin,
  resolveCommitHash,
  type CloneOptions,
  type FetchOptions,
  type GitPluginEntry,
  type ParsedGitUrl
} from "../git-plugin-store.ts";

// CONSTANTS
const kUsage = `Usage: rezzou plugin <subcommand> [options]

Subcommands:
  add <path|url>  Add a plugin by file path or git URL
  list            List all loaded plugins
  remove <path>   Remove a plugin by file path
  update <id>     Update a git-installed plugin to the latest commit

Options:
  -h, --help   Show this help message`;

export interface PluginStoreOptions {
  readPluginPaths: () => string[];
  scanPluginsDir: () => string[];
  addPluginPath: (filePath: string) => void;
  removePluginPath: (filePath: string) => void;
  fileExists: (filePath: string) => boolean;
  isGitUrl: (raw: string) => boolean;
  parseGitUrl: (raw: string) => ParsedGitUrl | null;
  gitPluginPath: (slug: string) => string;
  dirExists: (dirPath: string) => boolean;
  gitClone: (cloneUrl: string, targetPath: string, options: CloneOptions) => Promise<void>;
  resolveCommitHash: (targetPath: string) => Promise<string>;
  resolveEntry: (dirPath: string) => string | null;
  addGitPluginEntry: (entry: GitPluginEntry) => void;
  readGitPlugins: () => GitPluginEntry[];
  fetchGitPlugin: (targetPath: string, ref: string | null, options?: FetchOptions) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
}

const kDefaultStore: PluginStoreOptions = {
  readPluginPaths,
  scanPluginsDir,
  addPluginPath,
  removePluginPath,
  fileExists: (filePath) => fs.existsSync(filePath),
  isGitUrl,
  parseGitUrl,
  gitPluginPath,
  dirExists: (dirPath) => fs.existsSync(dirPath),
  gitClone: cloneGitPlugin,
  resolveCommitHash,
  resolveEntry: getSubfolderEntry,
  addGitPluginEntry,
  readGitPlugins,
  fetchGitPlugin,
  confirm: async(message) => confirm(message, { initial: false })
};

export async function pluginCommand(
  args: string[],
  store: PluginStoreOptions = kDefaultStore
): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true,
    strict: false
  });

  const [subcommand, ...rest] = positionals;

  if (values.help || !subcommand) {
    console.log(kUsage);

    return;
  }

  if (subcommand === "add") {
    const [target] = rest;
    if (!target) {
      console.log(kUsage);

      return;
    }

    if (store.isGitUrl(target)) {
      const parsed = store.parseGitUrl(target);
      if (!parsed) {
        console.error(`Invalid git URL: ${target}`);

        return;
      }

      const targetPath = store.gitPluginPath(parsed.slug);
      if (store.dirExists(targetPath)) {
        console.error(`Plugin "${parsed.slug}" is already installed. Use "rezzou plugin update ${parsed.slug}" to update it.`);

        return;
      }

      try {
        await store.gitClone(parsed.cloneUrl, targetPath, { ref: parsed.ref });
      }
      catch (error) {
        console.error(`Clone failed: ${error instanceof Error ? error.message : String(error)}`);

        return;
      }

      const pinnedCommit = await store.resolveCommitHash(targetPath);

      let entry: string | null;
      try {
        entry = store.resolveEntry(targetPath);
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Could not resolve plugin entry point in "${targetPath}": ${message}`);

        return;
      }
      if (!entry) {
        console.error(`Could not resolve plugin entry point in "${targetPath}".`);

        return;
      }

      store.addGitPluginEntry({
        slug: parsed.slug,
        url: target,
        ref: parsed.ref,
        pinnedCommit,
        installedAt: new Date().toISOString()
      });
      store.addPluginPath(entry);
      console.log(`Plugin installed: ${parsed.slug} (${entry})`);

      return;
    }

    const resolved = path.resolve(target);
    if (!store.fileExists(resolved)) {
      console.error(`File not found: ${resolved}`);

      return;
    }

    store.addPluginPath(resolved);
    console.log(`Plugin added: ${resolved}`);

    return;
  }

  if (subcommand === "list") {
    const manual = store.readPluginPaths();
    const autoScanned = store.scanPluginsDir();

    console.log("Manually added:");
    if (manual.length === 0) {
      console.log("  (none)");
    }
    else {
      for (const pluginPath of manual) {
        console.log(`  ${pluginPath}`);
      }
    }

    console.log("\nAuto-scanned (~/.rezzou/plugins/):");
    if (autoScanned.length === 0) {
      console.log("  (none)");
    }
    else {
      for (const pluginPath of autoScanned) {
        console.log(`  ${pluginPath}`);
      }
    }

    return;
  }

  if (subcommand === "remove") {
    const [filePath] = rest;
    if (!filePath) {
      console.log(kUsage);

      return;
    }

    const resolved = path.resolve(filePath);
    store.removePluginPath(resolved);
    console.log(`Plugin removed: ${resolved}`);

    return;
  }

  if (subcommand === "update") {
    const [id] = rest;
    if (!id) {
      console.log(kUsage);

      return;
    }

    const entries = store.readGitPlugins();
    const entry = entries.find((gitEntry) => gitEntry.slug === id);
    if (!entry) {
      console.error(`Plugin "${id}" is not a git-installed plugin.`);

      return;
    }

    const targetPath = store.gitPluginPath(entry.slug);
    if (!store.dirExists(targetPath)) {
      console.error(`Plugin directory not found: ${targetPath}`);

      return;
    }

    try {
      await store.fetchGitPlugin(targetPath, entry.ref);
    }
    catch (error) {
      console.error(`Update failed: ${error instanceof Error ? error.message : String(error)}`);

      return;
    }

    const newCommit = await store.resolveCommitHash(targetPath);

    if (newCommit === entry.pinnedCommit) {
      console.log(`Plugin "${id}" is already up to date (${newCommit.slice(0, 8)}).`);

      return;
    }

    console.warn(`Plugin updated from \`${entry.pinnedCommit.slice(0, 8)}\` to \`${newCommit.slice(0, 8)}\`.`);
    const confirmed = await store.confirm("Apply this update?");
    if (!confirmed) {
      console.log("Update cancelled.");

      return;
    }

    store.addGitPluginEntry({ ...entry, pinnedCommit: newCommit });
    console.log(`Plugin "${id}" updated to ${newCommit.slice(0, 8)}.`);

    return;
  }

  console.error(`Unknown subcommand: ${subcommand}\n`);
  console.log(kUsage);
}
