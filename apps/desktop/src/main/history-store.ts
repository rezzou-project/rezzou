// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// CONSTANTS
const kRezzouDir = path.join(os.homedir(), ".rezzou");
const kHistoryFile = path.join(kRezzouDir, "history.json");
const kMaxEntries = 100;

export interface HistoryEntryResult {
  repoName: string;
  repoFullPath: string;
  status: "done" | "error";
  prUrl?: string;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  operationId: string;
  namespace: string;
  results: HistoryEntryResult[];
}

export function readHistory(): HistoryEntry[] {
  if (!fs.existsSync(kHistoryFile)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(kHistoryFile, "utf-8")) as HistoryEntry[];
  }
  catch {
    return [];
  }
}

export function addHistoryEntry(entry: HistoryEntry): void {
  const entries = readHistory();
  entries.unshift(entry);
  if (entries.length > kMaxEntries) {
    entries.length = kMaxEntries;
  }
  fs.mkdirSync(kRezzouDir, { recursive: true });
  fs.writeFileSync(kHistoryFile, JSON.stringify(entries, null, 2));
}
