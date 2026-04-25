// Import Node.js Dependencies
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { parseArgs } from "node:util";

// CONSTANTS
const kRezzouDir = path.join(os.homedir(), ".rezzou");
const kHistoryFile = path.join(kRezzouDir, "history.json");
const kDefaultLimit = 10;
const kUsage = `Usage: rezzou history [options]

Options:
  -n, --limit <n>  Number of entries to show (default: ${kDefaultLimit})
  --json           Output as JSON
  -h, --help       Show this help message`;

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

export interface HistoryDeps {
  readHistory: () => HistoryEntry[];
}

function defaultReadHistory(): HistoryEntry[] {
  if (fs.existsSync(kHistoryFile)) {
    try {
      return JSON.parse(fs.readFileSync(kHistoryFile, "utf-8")) as HistoryEntry[];
    }
    catch {
      return [];
    }
  }

  return [];
}

const kDefaultDeps: HistoryDeps = {
  readHistory: defaultReadHistory
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 19);
}

function formatEntrySummary(results: HistoryEntryResult[]): string {
  let done = 0;
  let errors = 0;

  for (const result of results) {
    if (result.status === "done") {
      done++;
    }
    else {
      errors++;
    }
  }

  if (errors > 0) {
    return `${done} done, ${errors} error${errors > 1 ? "s" : ""}`;
  }

  return `${done} done`;
}

function printEntry(entry: HistoryEntry, index: number): void {
  const summary = formatEntrySummary(entry.results);
  console.log(`\n#${index + 1}  ${formatTimestamp(entry.timestamp)}  ${entry.operationId} @ ${entry.namespace}  (${summary})`);

  for (const result of entry.results) {
    if (result.status === "error") {
      console.log(`  [error]  ${result.repoFullPath}  ${result.error ?? "unknown error"}`);
    }
    else if (result.prUrl) {
      console.log(`  [done]   ${result.repoFullPath}  →  ${result.prUrl}`);
    }
    else {
      console.log(`  [done]   ${result.repoFullPath}`);
    }
  }
}

export async function historyCommand(
  args: string[],
  deps: HistoryDeps = kDefaultDeps
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      limit: { type: "string", short: "n" },
      json: { type: "boolean" }
    },
    strict: false
  });

  if (values.help) {
    console.log(kUsage);

    return;
  }

  const limit = typeof values.limit === "string" ? parseInt(values.limit, 10) : kDefaultLimit;

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error(`Invalid limit: "${values.limit}". Must be a positive integer.`);
  }

  const entries = deps.readHistory().slice(0, limit);

  if (values.json) {
    console.log(JSON.stringify(entries, null, 2));

    return;
  }

  if (entries.length === 0) {
    console.log("No history found.");

    return;
  }

  for (const [entryIndex, entry] of entries.entries()) {
    printEntry(entry, entryIndex);
  }
}
