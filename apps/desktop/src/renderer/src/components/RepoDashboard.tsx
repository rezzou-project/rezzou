// Import Third-party Dependencies
import { useState } from "react";

// Import Internal Dependencies
import { useAppStore, type RepoStatsEntry } from "../stores/app.js";
import type { Repo } from "@rezzou/core";

// CONSTANTS
const kStatCap = 100;

type SortKey = "name" | "openMRs" | "openIssues" | "branches";
type SortDir = "asc" | "desc";

function resolveStatField(entry: RepoStatsEntry, field: Exclude<SortKey, "name">): number | null | "loading" {
  if (entry === "loading") {
    return "loading";
  }
  if (entry === null) {
    return null;
  }

  return entry[field];
}

function statSortValue(entry: RepoStatsEntry, field: Exclude<SortKey, "name">): number {
  if (entry === "loading" || entry === null) {
    return -1;
  }

  return entry[field];
}

function StatBadge({ value }: { value: number | null | "loading"; }) {
  if (value === "loading") {
    return <span className="inline-block h-4 w-8 animate-pulse rounded bg-gray-700" />;
  }

  if (value === null) {
    return <span className="text-gray-600">—</span>;
  }

  return (
    <span className={value > 0 ? "font-medium text-white" : "text-gray-500"}>
      {value >= kStatCap ? `${kStatCap - 1}+` : value}
    </span>
  );
}

function BranchBadge({ branch }: { branch: string; }) {
  const color = branch === "main"
    ? "border-green-800 bg-green-950 text-green-400"
    : branch === "master"
    ? "border-yellow-800 bg-yellow-950 text-yellow-400"
    : "border-gray-700 bg-gray-800 text-gray-400";

  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs ${color}`}>
      {branch}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir; }) {
  if (!active) {
    return <span className="ml-1 text-gray-600">↕</span>;
  }

  return <span className="ml-1 text-blue-400">{dir === "asc" ? "↑" : "↓"}</span>;
}

function RepoDashboardRow({ repo }: { repo: Repo; }) {
  const isSelected = useAppStore((state) => state.selectedRepoIds.includes(repo.id));
  const toggleRepo = useAppStore((state) => state.toggleRepo);
  const statsEntry = useAppStore((state) => state.repoStats[repo.id] ?? "loading");

  return (
    <tr
      className={`cursor-pointer border-b border-gray-800 transition-colors hover:bg-gray-900/50 ${isSelected ? "bg-gray-900/30" : ""}`}
      onClick={() => toggleRepo(repo.id)}
    >
      <td className="w-10 px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleRepo(repo.id)}
          onClick={(evt) => evt.stopPropagation()}
          className="h-4 w-4 cursor-pointer rounded border-gray-600 accent-blue-600"
        />
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium">{repo.name}</span>
      </td>
      <td className="px-4 py-3">
        <BranchBadge branch={repo.defaultBranch} />
      </td>
      <td className="px-4 py-3 text-center text-sm">
        <StatBadge value={resolveStatField(statsEntry, "openMRs")} />
      </td>
      <td className="px-4 py-3 text-center text-sm">
        <StatBadge value={resolveStatField(statsEntry, "openIssues")} />
      </td>
      <td className="px-4 py-3 text-center text-sm">
        <StatBadge value={resolveStatField(statsEntry, "branches")} />
      </td>
      <td className="px-2 py-3 text-right">
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          onClick={(evt) => evt.stopPropagation()}
          className="text-gray-500 transition-colors hover:text-gray-200"
          title="Open in browser"
        >
          ↗
        </a>
      </td>
    </tr>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentKey,
  dir,
  onSort
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <SortIcon active={currentKey === sortKey} dir={dir} />
    </th>
  );
}

export function RepoDashboard() {
  const {
    repos,
    selectedRepoIds,
    selectedNamespace,
    selectAll,
    deselectAll,
    proceedToPickOperation,
    repoStats,
    loadAllRepoStats
  } = useAppStore();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allSelected = selectedRepoIds.length === repos.length && repos.length > 0;
  const isLoadingStats = Object.values(repoStats).some((entry) => entry === "loading");
  const statsLoaded = Object.values(repoStats).filter((entry) => entry !== "loading").length;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    }
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const filtered = repos.filter((repo) => repo.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...filtered].sort((repoA, repoB) => {
    let comparison = 0;

    if (sortKey === "name") {
      comparison = repoA.name.localeCompare(repoB.name);
    }
    else {
      const statsA = repoStats[repoA.id] ?? "loading";
      const statsB = repoStats[repoB.id] ?? "loading";
      comparison = statSortValue(statsA, sortKey) - statSortValue(statsB, sortKey);
    }

    return sortDir === "asc" ? comparison : -comparison;
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">{selectedNamespace?.displayName ?? ""}</h2>
        <p className="mt-1 text-sm text-gray-400">
          {repos.length} repositories
          {repos.length > 0 && <span> · {selectedRepoIds.length} selected</span>}
          {isLoadingStats && (
            <span className="ml-2 text-gray-600">· fetching stats {statsLoaded}/{repos.length}</span>
          )}
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter repositories…"
          value={search}
          onChange={(evt) => setSearch(evt.target.value)}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-gray-500"
        />

        <button
          onClick={allSelected ? deselectAll : selectAll}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-500"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>

        <button
          onClick={() => void loadAllRepoStats()}
          disabled={isLoadingStats}
          title="Refresh stats"
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↺
        </button>

        <button
          onClick={proceedToPickOperation}
          disabled={selectedRepoIds.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run operations ({selectedRepoIds.length})
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800">
        <table className="w-full">
          <thead className="border-b border-gray-800 bg-gray-900/60">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={allSelected ? deselectAll : selectAll}
                  className="h-4 w-4 cursor-pointer rounded border-gray-600 accent-blue-600"
                />
              </th>
              <SortableHeader label="Repository" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                Branch
              </th>
              <SortableHeader label="Open PRs" sortKey="openMRs" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Issues" sortKey="openIssues" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Branches" sortKey="branches" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((repo) => (
              <RepoDashboardRow key={repo.id} repo={repo} />
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && search.length > 0 && (
          <div className="py-12 text-center text-sm text-gray-500">
            No repositories match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
