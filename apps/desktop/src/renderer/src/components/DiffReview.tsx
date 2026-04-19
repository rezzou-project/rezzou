// Import Third-party Dependencies
import { useState, useRef, useEffect } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import type { RepoDiff } from "../stores/app.js";
import type { Member, Patch } from "@rezzou/core";

// CONSTANTS
const kContextLines = 2;

type DiffLineType = "context" | "removed" | "added";

interface DiffLine {
  type: DiffLineType;
  content: string;
}

function computeLineDiff(original: string, updated: string): DiffLine[] {
  const originalLines = original.split("\n");
  const updatedLines = updated.split("\n");
  const result: DiffLine[] = [];
  const maxLen = Math.max(originalLines.length, updatedLines.length);

  for (let lineIndex = 0; lineIndex < maxLen; lineIndex++) {
    const originalLine = originalLines[lineIndex] ?? "";
    const updatedLine = updatedLines[lineIndex] ?? "";

    if (originalLine === updatedLine) {
      result.push({ type: "context", content: originalLine });
    }
    else {
      if (originalLines[lineIndex] !== undefined) {
        result.push({ type: "removed", content: originalLine });
      }

      if (updatedLines[lineIndex] !== undefined) {
        result.push({ type: "added", content: updatedLine });
      }
    }
  }

  return result;
}

function filterDiffContext(lines: DiffLine[]): DiffLine[] {
  const changedIndices = lines.flatMap((line, index) => (line.type !== "context" ? [index] : []));

  if (changedIndices.length === 0) {
    return [];
  }

  const firstChanged = changedIndices.at(0)!;
  const lastChanged = changedIndices.at(-1)!;
  const start = Math.max(0, firstChanged - kContextLines);
  const end = Math.min(lines.length - 1, lastChanged + kContextLines);

  return lines.slice(start, end + 1);
}

interface FileDiffProps {
  patch: Patch;
  original: string;
}

function FileDiff({ patch, original }: FileDiffProps) {
  const [open, setOpen] = useState(true);
  const source = patch.action !== "create" ? original : "";
  const lineDiff = filterDiffContext(computeLineDiff(source, patch.content ?? ""));

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-800"
      >
        <span className="select-none text-gray-500">{open ? "▾" : "▸"}</span>
        <span className="font-mono text-xs text-gray-300">{patch.path}</span>
      </button>
      {open && (
        <pre className="overflow-x-auto px-4 pb-4 font-mono text-xs leading-5">
          {lineDiff.map((line, lineIndex) => (
            <div
              key={lineIndex}
              className={
                line.type === "removed"
                  ? "bg-red-950 text-red-300"
                  : line.type === "added"
                    ? "bg-green-950 text-green-300"
                    : "text-gray-400"
              }
            >
              <span className="mr-3 select-none text-gray-600">
                {line.type === "removed" ? "-" : line.type === "added" ? "+" : " "}
              </span>
              {line.content}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

function DiffCard({ diff }: { diff: RepoDiff; }) {
  const { openApplyModal } = useAppStore();

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <span className="text-sm font-medium">{diff.repo.name}</span>

        {diff.applyStatus === "pending" && (
          <button
            onClick={() => void openApplyModal("single", diff.repo.fullPath)}
            className="rounded border border-green-700 px-3 py-1 text-xs text-green-400 transition-colors hover:bg-green-950"
          >
            Apply
          </button>
        )}

        {diff.applyStatus === "applying" && (
          <span className="text-xs text-yellow-400">Applying...</span>
        )}

        {diff.applyStatus === "done" && diff.prUrl !== undefined && (
          <a
            href={diff.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-400 hover:underline"
          >
            View MR →
          </a>
        )}

        {diff.applyStatus === "error" && (
          <span className="text-xs text-red-400">{diff.error}</span>
        )}
      </div>

      <div className="divide-y divide-gray-800">
        {diff.patches.map((patch) => (
          <FileDiff
            key={patch.path}
            patch={patch}
            original={diff.originals[patch.path] ?? ""}
          />
        ))}
      </div>
    </div>
  );
}

interface ReviewerSelectProps {
  members: Member[];
  isLoading: boolean;
  selected: string[];
  onChange: (reviewers: string[]) => void;
}

function ReviewerSelect({ members, isLoading, selected, onChange }: ReviewerSelectProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = members.filter((m) => {
    return !selected.includes(m.username) && m.username.toLowerCase().includes(filter.toLowerCase());
  });

  function add(username: string) {
    onChange([...selected, username]);
    setFilter("");
  }

  function remove(username: string) {
    onChange(selected.filter((u) => u !== username));
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex min-h-[32px] flex-wrap items-center gap-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 cursor-text focus-within:border-gray-500"
        onClick={() => setOpen(true)}
      >
        {selected.map((username) => {
          const member = members.find((m) => m.username === username);

          return (
            <span key={username} className="flex items-center gap-1 rounded bg-gray-700 pl-1 pr-1.5 py-0.5 text-xs text-gray-200">
              {member?.avatarUrl
                ? <img src={member.avatarUrl} referrerPolicy="no-referrer" className="h-3.5 w-3.5 rounded-full" alt="" />
                : <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-600 text-gray-300" style={{ fontSize: "9px" }}>{username[0].toUpperCase()}</span>
              }
              {username}
              <button
                onClick={(e) => { e.stopPropagation(); remove(username); }}
                className="ml-0.5 leading-none text-gray-400 hover:text-gray-200"
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Add reviewers..." : ""}
          className="min-w-[80px] flex-1 bg-transparent text-xs text-gray-200 focus:outline-none"
        />
      </div>

      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-gray-700 bg-gray-900 shadow-lg">
          {isLoading
            ? <p className="px-3 py-2 text-xs text-gray-500">Loading members...</p>
            : filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-gray-500">{filter ? "No match" : "All members added"}</p>
              : filtered.map((member) => (
                <button
                  key={member.username}
                  onClick={() => add(member.username)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-800"
                >
                  {member.avatarUrl
                    ? <img src={member.avatarUrl} referrerPolicy="no-referrer" className="h-5 w-5 flex-shrink-0 rounded-full" alt="" />
                    : <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-700 text-gray-400 text-[10px]">{member.username[0].toUpperCase()}</span>
                  }
                  {member.username}
                </button>
              ))
          }
        </div>
      )}
    </div>
  );
}

function ApplyModal() {
  const {
    applyModalTarget,
    applyModalRepoPath,
    diffs,
    operationOverrides,
    setOperationOverrides,
    closeApplyModal,
    confirmApply,
    selectedNamespace
  } = useAppStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);

  const pendingCount = diffs.filter((d) => d.applyStatus === "pending").length;
  const targetDiff = diffs.find((d) => d.repo.fullPath === applyModalRepoPath) ?? null;

  useEffect(() => {
    if (applyModalTarget !== null && selectedNamespace?.type === "org") {
      setIsFetchingMembers(true);
      window.api.fetchMembers(selectedNamespace.name)
        .then(setMembers)
        .catch(() => setMembers([]))
        .finally(() => setIsFetchingMembers(false));
    }
  }, [applyModalTarget, selectedNamespace]);

  if (applyModalTarget === null) {
    return null;
  }

  const title = applyModalTarget === "all"
    ? `Apply to all (${pendingCount})`
    : `Apply to ${targetDiff?.repo.name ?? ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-2xl">
        <h3 className="mb-1 text-base font-semibold">{title}</h3>
        <p className="mb-5 text-xs text-gray-500">Review the commit settings before submitting.</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Branch name</label>
            <input
              type="text"
              value={operationOverrides.branchName ?? ""}
              onChange={(e) => setOperationOverrides({ branchName: e.target.value })}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Commit message</label>
            <input
              type="text"
              value={operationOverrides.commitMessage ?? ""}
              onChange={(e) => setOperationOverrides({ commitMessage: e.target.value })}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">PR / MR title</label>
            <input
              type="text"
              value={operationOverrides.prTitle ?? ""}
              onChange={(e) => setOperationOverrides({ prTitle: e.target.value })}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">PR / MR description</label>
            <input
              type="text"
              value={operationOverrides.prDescription ?? ""}
              onChange={(e) => setOperationOverrides({ prDescription: e.target.value })}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 focus:border-gray-500 focus:outline-none"
            />
          </div>
          {selectedNamespace?.type === "org" && (
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-gray-500">Reviewers <span className="text-gray-600">(optional)</span></label>
              <ReviewerSelect
                members={members}
                isLoading={isFetchingMembers}
                selected={operationOverrides.reviewers ?? []}
                onChange={(reviewers) => setOperationOverrides({ reviewers })}
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={closeApplyModal}
            className="rounded-lg border border-gray-700 px-4 py-1.5 text-sm font-medium transition-colors hover:border-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => void confirmApply()}
            className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-green-600"
          >
            {applyModalTarget === "all" ? `Apply all (${pendingCount})` : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface OperationInfo {
  id: string;
  name: string;
  description: string;
}

export function DiffReview() {
  const { diffs, openApplyModal, backToPickOperation, selectedOperationId } = useAppStore();
  const [selectedOp, setSelectedOp] = useState<OperationInfo | null>(null);
  const pendingCount = diffs.filter((diff) => diff.applyStatus === "pending").length;
  const doneCount = diffs.filter((diff) => diff.applyStatus === "done").length;
  const isApplying = diffs.some((diff) => diff.applyStatus === "applying");

  useEffect(() => {
    void window.api.listOperations().then((ops) => {
      setSelectedOp(ops.find((op) => op.id === selectedOperationId) ?? null);
    });
  }, [selectedOperationId]);

  if (diffs.length === 0) {
    return (
      <div className="pt-20 text-center">
        <p className="mb-4 text-gray-400">No files need updating.</p>
        <button
          onClick={backToPickOperation}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium transition-colors hover:border-gray-500"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <ApplyModal />

      <div className="mb-6 flex items-center justify-between">
        <div>
          {doneCount === 0 && !isApplying && (
            <button
              onClick={backToPickOperation}
              className="mb-1 text-xs text-gray-500 transition-colors hover:text-gray-300"
            >
              ← Back
            </button>
          )}
          <h2 className="text-xl font-semibold">{selectedOp?.name ?? "Updates"}</h2>
          <p className="text-sm text-gray-400">
            {diffs.length} repos to update · {doneCount} done
          </p>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={() => void openApplyModal("all")}
            disabled={isApplying}
            className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply all ({pendingCount})
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {diffs.map((diff) => (
          <DiffCard key={diff.repo.id} diff={diff} />
        ))}
      </div>
    </div>
  );
}
