// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// CONSTANTS
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

export function getSubfolderEntry(dirPath: string): string | null {
  for (const candidate of ["index.ts", "index.js", "index.mjs"]) {
    const entry = path.join(dirPath, candidate);
    if (fs.existsSync(entry)) {
      return entry;
    }
  }

  const pkgFile = path.join(dirPath, "package.json");
  if (!fs.existsSync(pkgFile)) {
    return null;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf-8")) as { main?: string; };
    if (pkg.main) {
      const entry = path.join(dirPath, pkg.main);

      return fs.existsSync(entry) ? entry : null;
    }
  }
  catch {
    // skip unparseable package.json
  }

  return null;
}

export function scanPluginsDir(): string[] {
  if (!fs.existsSync(kPluginsDir)) {
    return [];
  }

  return fs.readdirSync(kPluginsDir).flatMap((name) => {
    const fullPath = path.join(kPluginsDir, name);
    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
      return /\.(js|mjs|ts)$/.test(name) ? [fullPath] : [];
    }

    if (stat.isDirectory()) {
      const entry = getSubfolderEntry(fullPath);

      return entry === null ? [] : [entry];
    }

    return [];
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

export function removePluginPath(filePath: string): void {
  const paths = readPluginPaths().filter((pluginPath) => pluginPath !== filePath);
  fs.mkdirSync(kRezzouDir, { recursive: true });
  fs.writeFileSync(kPluginsFile, JSON.stringify(paths, null, 2));
}
