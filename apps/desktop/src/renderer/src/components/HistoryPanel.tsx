// Import Third-party Dependencies
import { useState } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

interface EntryCardProps {
  entry: HistoryEntry;
}

function EntryCard({ entry }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const successCount = entry.results.filter((result) => result.status === "done").length;
  const errorCount = entry.results.filter((result) => result.status === "error").length;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{entry.operationId}</span>
          {entry.namespace.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">{entry.namespace}</span>
          )}
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-3 text-xs">
          {successCount > 0 && (
            <span className="text-green-400">{successCount} ok</span>
          )}
          {errorCount > 0 && (
            <span className="text-red-400">{errorCount} err</span>
          )}
          <span className="text-gray-500">{formatTimestamp(entry.timestamp)}</span>
          <span className="text-gray-600">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-2">
          <div className="flex flex-col gap-1">
            {entry.results.map((result) => (
              <div key={result.repoFullPath} className="flex items-center justify-between py-1 text-xs">
                <span className={result.status === "done" ? "text-gray-300" : "text-red-400"}>
                  {result.repoName}
                </span>
                <div className="ml-3 shrink-0">
                  {result.prUrl !== undefined && (
                    <a
                      href={result.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Open MR →
                    </a>
                  )}
                  {result.error !== undefined && (
                    <span className="text-red-500">{result.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryPanel() {
  const historyEntries = useAppStore((state) => state.historyEntries);
  const goHome = useAppStore((state) => state.goHome);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">History</h2>
          <p className="text-sm text-gray-400">Past operations</p>
        </div>
        <button
          type="button"
          onClick={goHome}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
        >
          ← Back
        </button>
      </div>

      {historyEntries.length === 0 ? (
        <p className="text-sm text-gray-500">No history yet.</p>
      ) : (
        <div className="space-y-2">
          {historyEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
