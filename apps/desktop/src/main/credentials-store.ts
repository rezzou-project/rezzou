// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// Import Third-party Dependencies
import { safeStorage } from "electron";

// CONSTANTS
const kRezzouDir = path.join(os.homedir(), ".rezzou");
const kCredentialsFile = path.join(kRezzouDir, "credentials.json");

export function saveCredentials(token: string, provider: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption is not available on this system. Token cannot be persisted securely.");
  }

  let existing: Record<string, string> = {};

  if (fs.existsSync(kCredentialsFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;
    }
    catch {
      // ignore malformed file
    }
  }

  const encrypted = safeStorage.encryptString(token).toString("base64");
  fs.mkdirSync(kRezzouDir, { recursive: true });
  fs.writeFileSync(kCredentialsFile, JSON.stringify({ ...existing, [provider]: encrypted }));
}

export function loadSavedCredentials(): { token: string; provider: string; }[] {
  if (!fs.existsSync(kCredentialsFile)) {
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;
    const results: { token: string; provider: string; }[] = [];

    for (const provider of Object.keys(raw)) {
      try {
        const token = safeStorage.decryptString(Buffer.from(raw[provider], "base64"));
        results.push({ token, provider });
      }
      catch {
        // skip corrupted entry
      }
    }

    return results;
  }
  catch {
    return [];
  }
}
