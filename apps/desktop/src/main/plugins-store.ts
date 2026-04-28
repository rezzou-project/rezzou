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

interface PackageJson {
  main?: string;
  rezzou?: {
    entry?: string;
  };
}

export function getSubfolderEntry(dirPath: string): string | null {
  const pkgFile = path.join(dirPath, "package.json");

  if (fs.existsSync(pkgFile)) {
    let pkg: PackageJson;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgFile, "utf-8")) as PackageJson;
    }
    catch {
      return null;
    }

    const rezzouEntry = pkg.rezzou?.entry;
    if (rezzouEntry) {
      const entry = path.join(dirPath, rezzouEntry);

      return fs.existsSync(entry) ? entry : null;
    }

    if (pkg.main) {
      const entry = path.join(dirPath, pkg.main);

      return fs.existsSync(entry) ? entry : null;
    }

    throw new Error(`Plugin at "${dirPath}" has a package.json but no "main" or "rezzou.entry" field`);
  }

  for (const candidate of ["index.ts", "index.mjs", "index.js"]) {
    const entry = path.join(dirPath, candidate);
    if (fs.existsSync(entry)) {
      return entry;
    }
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
      return /\.(js|mjs|ts)$/.test(name) ? fullPath : [];
    }

    if (stat.isDirectory()) {
      let entry: string | null;
      try {
        entry = getSubfolderEntry(fullPath);
      }
      catch (error) {
        console.warn(`Warning: ${error instanceof Error ? error.message : String(error)}`);

        return [];
      }

      return entry === null ? [] : entry;
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
  const paths = readPluginPaths().filter((p) => p !== filePath);
  fs.mkdirSync(kRezzouDir, { recursive: true });
  fs.writeFileSync(kPluginsFile, JSON.stringify(paths, null, 2));
}
