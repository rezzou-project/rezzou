// Import Node.js Dependencies
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// CONSTANTS
const kRezzouDir = path.join(os.homedir(), ".rezzou");
const kCliCredentialsFile = path.join(kRezzouDir, "cli-credentials.json");

export function saveToken(provider: string, token: string): void {
  let existing: Record<string, string> = {};

  if (fs.existsSync(kCliCredentialsFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(kCliCredentialsFile, "utf-8")) as Record<string, string>;
    }
    catch {
      // ignore malformed file
    }
  }

  fs.mkdirSync(kRezzouDir, { recursive: true });
  fs.writeFileSync(kCliCredentialsFile, JSON.stringify({ ...existing, [provider]: token }));
}

export function loadToken(provider: string): string | null {
  if (!fs.existsSync(kCliCredentialsFile)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(kCliCredentialsFile, "utf-8")) as Record<string, string>;

    return raw[provider] ?? null;
  }
  catch {
    return null;
  }
}
