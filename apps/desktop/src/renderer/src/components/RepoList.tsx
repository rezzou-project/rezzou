// Import Third-party Dependencies
import { useState, useEffect } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import type { Repo } from "@rezzou/core";

interface FilterInfo {
  id: string;
  name: string;
  description?: string;
}

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
  const {
    repos,
    selectedRepoIds,
    selectedNamespace,
    activeFilterIds,
    isFilteringRepos,
    filteredRepoIds,
    selectAll,
    deselectAll,
    proceedToPickOperation,
    toggleFilter,
    clearFilters,
    isLoading
  } = useAppStore();

  const [availableFilters, setAvailableFilters] = useState<FilterInfo[]>([]);

  useEffect(() => {
    void window.api.listFilters().then(setAvailableFilters);

    return window.api.onFiltersChanged(setAvailableFilters);
  }, []);

  const visibleRepos = filteredRepoIds !== null
    ? repos.filter((repo) => filteredRepoIds.includes(repo.id))
    : repos;

  const allVisibleSelected = visibleRepos.length > 0 &&
    visibleRepos.every((repo) => selectedRepoIds.includes(repo.id));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{selectedNamespace?.displayName ?? ""}</h2>
          <p className="text-sm text-gray-400">
            {filteredRepoIds !== null
              ? `Showing ${filteredRepoIds.length} of ${repos.length} repositories · ${selectedRepoIds.length} selected`
              : `${repos.length} repositories · ${selectedRepoIds.length} selected`}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={allVisibleSelected ? deselectAll : selectAll}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-500"
          >
            {allVisibleSelected ? "Deselect all" : "Select all"}
          </button>

          <button
            onClick={proceedToPickOperation}
            disabled={isLoading || selectedRepoIds.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>

      {availableFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
          <span className="text-xs text-gray-500">Filters:</span>
          {availableFilters.map((filter) => (
            <label
              key={filter.id}
              title={filter.description}
              className="flex cursor-pointer items-center gap-1.5"
            >
              <input
                type="checkbox"
                checked={activeFilterIds.includes(filter.id)}
                onChange={() => toggleFilter(filter.id)}
                disabled={isFilteringRepos}
                className="h-3.5 w-3.5 rounded border-gray-600 accent-blue-600 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-300">{filter.name}</span>
            </label>
          ))}
          {activeFilterIds.length > 0 && (
            <button
              onClick={clearFilters}
              className="ml-1 text-xs text-gray-500 transition-colors hover:text-gray-300"
            >
              Clear
            </button>
          )}
          {isFilteringRepos && (
            <span className="text-xs text-gray-500">Filtering…</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visibleRepos.map((repo) => (
          <RepoItem key={repo.id} repo={repo} />
        ))}
      </div>
    </div>
  );
}
