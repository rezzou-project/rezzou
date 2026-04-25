// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import {
  readPluginPaths,
  scanPluginsDir,
  addPluginPath,
  removePluginPath
} from "../plugin-store.ts";

// CONSTANTS
const kUsage = `Usage: rezzou plugin <subcommand> [options]

Subcommands:
  add <path>     Add a plugin by file path
  list           List all loaded plugins
  remove <path>  Remove a plugin by file path

Options:
  -h, --help   Show this help message`;

export interface PluginStoreOptions {
  readPluginPaths: () => string[];
  scanPluginsDir: () => string[];
  addPluginPath: (filePath: string) => void;
  removePluginPath: (filePath: string) => void;
  fileExists: (filePath: string) => boolean;
}

const kDefaultStore: PluginStoreOptions = {
  readPluginPaths,
  scanPluginsDir,
  addPluginPath,
  removePluginPath,
  fileExists: (filePath) => fs.existsSync(filePath)
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
    const [filePath] = rest;
    if (!filePath) {
      console.log(kUsage);

      return;
    }

    const resolved = path.resolve(filePath);
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
