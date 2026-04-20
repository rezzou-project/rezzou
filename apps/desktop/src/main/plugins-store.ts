// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

const kDir = path.join(os.homedir(), ".rezzou");
const kFile = path.join(kDir, "plugins.json");

export function readPluginPaths(): string[] {
  if (!fs.existsSync(kFile)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(kFile, "utf-8")) as string[];
  }
  catch {
    return [];
  }
}

export function addPluginPath(filePath: string): void {
  const paths = readPluginPaths();
  if (paths.includes(filePath)) {
    return;
  }
  paths.push(filePath);
  fs.mkdirSync(kDir, { recursive: true });
  fs.writeFileSync(kFile, JSON.stringify(paths, null, 2));
}
