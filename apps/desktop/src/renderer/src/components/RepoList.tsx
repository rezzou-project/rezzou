// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import type { Repo } from "@rezzou/core";

function RepoItem({ repo }: { repo: Repo; }) {
  const isSelected = useAppStore((state) => state.selectedRepoIds.includes(repo.id));
  const toggleRepo = useAppStore((state) => state.toggleRepo);

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleRepo(repo.id)}
        className="h-4 w-4 rounded border-gray-600 accent-blue-600"
      />
      <div className="flex flex-1 items-center justify-between">
        <span className="text-sm font-medium">{repo.name}</span>
        <span className="text-xs text-gray-500">{repo.defaultBranch}</span>
      </div>
    </label>
  );
}

export function RepoList() {
  const { repos, selectedRepoIds, selectedNamespace, selectAll, deselectAll, scanRepos, isLoading } =
    useAppStore();
  const allSelected = selectedRepoIds.length === repos.length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{selectedNamespace?.displayName ?? ""}</h2>
          <p className="text-sm text-gray-400">
            {repos.length} repositories · {selectedRepoIds.length} selected
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={allSelected ? deselectAll : selectAll}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-500"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          <button
            onClick={scanRepos}
            disabled={isLoading || selectedRepoIds.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Scanning..." : "Scan for license year"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {repos.map((repo) => (
          <RepoItem key={repo.id} repo={repo} />
        ))}
      </div>
    </div>
  );
}
