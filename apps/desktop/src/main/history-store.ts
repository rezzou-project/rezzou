// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { randomUUID } from "node:crypto";

// Import Internal Dependencies
import type { HistoryEntry, RecordRunPayload } from "../shared/ipc-channels.ts";

// CONSTANTS
const kRezzouDir = path.join(os.homedir(), ".rezzou");
const kHistoryFile = path.join(kRezzouDir, "history.json");
const kMaxEntries = 100;

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

export function recordRun(payload: RecordRunPayload): void {
  addHistoryEntry({
    id: randomUUID(),
    timestamp: Date.now(),
    ...payload
  });
}
