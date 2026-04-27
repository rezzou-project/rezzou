// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import { parseArgs } from "node:util";

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
  cloneGitPlugin,
  type GitPluginEntry,
  type ParsedGitUrl
} from "../git-plugin-store.ts";

// CONSTANTS
const kUsage = `Usage: rezzou plugin <subcommand> [options]

Subcommands:
  add <path|url>  Add a plugin by file path or git URL
  list            List all loaded plugins
  remove <path>   Remove a plugin by file path

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
  gitClone: (cloneUrl: string, targetPath: string, ref: string | null) => Promise<void>;
  resolveEntry: (dirPath: string) => string | null;
  addGitPluginEntry: (entry: GitPluginEntry) => void;
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
  resolveEntry: getSubfolderEntry,
  addGitPluginEntry
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
        await store.gitClone(parsed.cloneUrl, targetPath, parsed.ref);
      }
      catch (error) {
        console.error(`Clone failed: ${error instanceof Error ? error.message : String(error)}`);

        return;
      }

      const entry = store.resolveEntry(targetPath);
      if (!entry) {
        console.error(`Could not resolve plugin entry point in "${targetPath}".`);

        return;
      }

      store.addGitPluginEntry({
        slug: parsed.slug,
        url: target,
        ref: parsed.ref,
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

  console.error(`Unknown subcommand: ${subcommand}\n`);
  console.log(kUsage);
}
