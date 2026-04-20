// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

const kRezzouDir = path.join(os.homedir(), ".rezzou");
const kPluginsFile = path.join(kRezzouDir, "plugins.json");
const kPluginsDir = path.join(kRezzouDir, "plugins");

export function readPluginPaths(): string[] {
  if (!fs.existsSync(kPluginsFile)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(kPluginsFile, "utf-8")) as string[];
  }
  catch {
    return [];
  }
}

export function scanPluginsDir(): string[] {
  if (!fs.existsSync(kPluginsDir)) {
    return [];
  }

  return fs.readdirSync(kPluginsDir).flatMap((name) => {
    if (/\.(js|mjs|ts)$/.test(name) === false) {
      return [];
    }

    return path.join(kPluginsDir, name);
  });
}

export function addPluginPath(filePath: string): void {
  const paths = readPluginPaths();
  if (paths.includes(filePath)) {
    return;
  }
  paths.push(filePath);
  fs.mkdirSync(kRezzouDir, { recursive: true });
  fs.writeFileSync(kPluginsFile, JSON.stringify(paths, null, 2));
}
