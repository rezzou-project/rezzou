// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";

// Import Third-party Dependencies
import { safeStorage } from "electron";

// CONSTANTS
const kCredentialsFile = "credentials.json";

export function saveCredentials(dataPath: string, token: string, provider: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption is not available on this system. Token cannot be persisted securely.");
  }

  const credPath = path.join(dataPath, kCredentialsFile);
  let existing: Record<string, string> = {};

  if (fs.existsSync(credPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(credPath, "utf-8")) as Record<string, string>;
    }
    catch {
      // ignore malformed file
    }
  }

  const encrypted = safeStorage.encryptString(token).toString("base64");
  fs.writeFileSync(credPath, JSON.stringify({ ...existing, [provider]: encrypted }));
}

export function loadSavedCredentials(dataPath: string): { token: string; provider: string; }[] {
  const credPath = path.join(dataPath, kCredentialsFile);
  if (!fs.existsSync(credPath)) {
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(credPath, "utf-8")) as Record<string, string>;
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
