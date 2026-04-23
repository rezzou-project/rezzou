// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";

export function ResultPanel() {
  const diffs = useAppStore((state) => state.diffs);
  const backToPickOperation = useAppStore((state) => state.backToPickOperation);
  const successDiffs = diffs.filter((diff) => diff.applyStatus === "done");
  const errorDiffs = diffs.filter((diff) => diff.applyStatus === "error");

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Done</h2>
          <p className="text-sm text-gray-400">
            {successDiffs.length} MRs created · {errorDiffs.length} errors
          </p>
        </div>
        <button
          onClick={backToPickOperation}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          ← Back
        </button>
      </div>

      {successDiffs.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-gray-300">Merge requests</h3>
          <div className="flex flex-col gap-2">
            {successDiffs.map((diff) => (
              <div
                key={diff.repo.id}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
              >
                <span className="text-sm">{diff.repo.name}</span>
                {diff.prUrl !== undefined && (
                  <a
                    href={diff.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline"
                  >
                    Open MR →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {errorDiffs.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-red-400">Errors</h3>
          <div className="flex flex-col gap-2">
            {errorDiffs.map((diff) => (
              <div
                key={diff.repo.id}
                className="rounded-lg border border-red-900 bg-red-950 px-4 py-3"
              >
                <span className="text-sm font-medium">{diff.repo.name}</span>
                {diff.error !== undefined && (
                  <p className={`mt-1 text-xs ${diff.errorCode === "rate-limit" ? "text-orange-400" : "text-red-400"}`}>
                    {diff.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
