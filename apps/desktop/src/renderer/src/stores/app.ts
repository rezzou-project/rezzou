// Import Third-party Dependencies
import { create } from "zustand";
import type {
  Provider,
  Namespace,
  Repo,
  RepoDiff as BaseRepoDiff,
  SubmitResult,
  OperationOverrides,
  RepoStats
} from "@rezzou/core";

// CONSTANTS
const kConcurrency = 5;
const kApplyConcurrency = 4;

let applyAllAbortController: AbortController | null = null;

type Step = "connect" | "home" | "repos" | "pick-operation" | "diffs" | "results" | "plugins" | "history";

function ipcErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  return error.message.replace(/^Error invoking remote method '[^']+': (?:\w+: )?/, "") || fallback;
}

export const applyStatus = {
  Pending: "pending",
  Applying: "applying",
  Done: "done",
  Error: "error",
  Skipped: "skipped"
} as const;
type ApplyStatus = (typeof applyStatus)[keyof typeof applyStatus];

type BranchConflictStrategy = "skip" | "force" | "suffix";

export interface RepoDiff extends BaseRepoDiff {
  applyStatus: ApplyStatus;
  prUrl?: string;
  error?: string;
}

export type RepoStatsEntry = RepoStats | null | "loading";

interface AppState {
  step: Step;
  connectedProviders: Partial<Record<Provider, Namespace[]>>;
  selectedNamespace: Namespace | null;
  repoCounts: Record<string, number>;
  repos: Repo[];
  selectedRepoIds: string[];
  repoStats: Record<string, RepoStatsEntry>;
  activeFilterIds: string[];
  isFilteringRepos: boolean;
  filteredRepoIds: string[] | null;
  selectedOperationId: string;
  diffs: RepoDiff[];
  operationInputs: Record<string, unknown>;
  operationOverrides: OperationOverrides;
  applyModalTarget: "single" | "all" | null;
  applyModalRepoPath: string | null;
  branchConflictModal: {
    conflictingPaths: string[];
    applyTarget: "single" | "all";
    applyRepoPath: string | null;
  } | null;
  branchConflictStrategy: {
    strategy: "force" | "suffix";
    conflictingPaths: string[];
    suffix?: string;
  } | null;
  isApplyingAll: boolean;
  isLoading: boolean;
  error: string | null;
  historyEntries: HistoryEntry[];
}

interface AppActions {
  autoLogin: () => Promise<void>;
  authenticate: (token: string, provider: Provider) => Promise<void>;
  receiveOAuthResult: (namespaces: Namespace[], provider: Provider) => void;
  goHome: () => void;
  goToPlugins: () => void;
  goToHistory: () => Promise<void>;
  loadRepos: (namespace: Namespace) => Promise<void>;
  loadAllRepoStats: () => Promise<void>;
  toggleRepo: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleFilter: (filterId: string) => Promise<void>;
  clearFilters: () => void;
  proceedToPickOperation: () => void;
  backToPickOperation: () => void;
  setSelectedOperation: (id: string) => void;
  scanRepos: () => Promise<void>;
  setOperationInputs: (inputs: Record<string, unknown>) => void;
  setOperationOverrides: (overrides: Partial<OperationOverrides>) => void;
  openApplyModal: (target: "single" | "all", repoPath?: string) => Promise<void>;
  closeApplyModal: () => void;
  confirmApply: () => Promise<void>;
  closeBranchConflictModal: () => void;
  resolveBranchConflict: (strategy: BranchConflictStrategy, suffix?: string) => Promise<void>;
  applyDiff: (repoPath: string) => Promise<void>;
  applyAll: () => Promise<void>;
  cancelApplyAll: () => void;
  reset: () => void;
}

const kInitialState: AppState = {
  step: "connect",
  connectedProviders: {},
  selectedNamespace: null,
  repoCounts: {},
  repos: [],
  selectedRepoIds: [],
  repoStats: {},
  activeFilterIds: [],
  isFilteringRepos: false,
  filteredRepoIds: null,
  selectedOperationId: "license-year",
  diffs: [],
  operationInputs: {},
  operationOverrides: {},
  applyModalTarget: null,
  applyModalRepoPath: null,
  branchConflictModal: null,
  branchConflictStrategy: null,
  isApplyingAll: false,
  isLoading: false,
  error: null,
  historyEntries: []
};

export const useAppStore = create<AppState & AppActions>((set, get) => {
  return {
    ...kInitialState,

    autoLogin: async() => {
      const sessions = await window.api.autoLogin();
      if (sessions !== null && sessions.length > 0) {
        const connectedProviders: Partial<Record<Provider, Namespace[]>> = {};
        for (const { provider, namespaces } of sessions) {
          connectedProviders[provider] = namespaces;
        }
        set({ connectedProviders, step: "home" });
      }
    },

    authenticate: async(token: string, provider: Provider) => {
      set({ isLoading: true, error: null });

      try {
        const namespaces = await window.api.authenticate(token, provider);

        set((state) => {
          return {
            connectedProviders: { ...state.connectedProviders, [provider]: namespaces },
            isLoading: false,
            step: state.step === "connect" ? "home" : state.step
          };
        });
      }
      catch (authenticateError) {
        set({
          isLoading: false,
          error: ipcErrorMessage(authenticateError, "Failed to connect")
        });
      }
    },

    receiveOAuthResult: (namespaces: Namespace[], provider: Provider) => {
      set((state) => {
        return {
          connectedProviders: { ...state.connectedProviders, [provider]: namespaces },
          isLoading: false,
          error: null,
          step: state.step === "connect" ? "home" : state.step
        };
      });
    },

    goHome: () => {
      set({ step: "home", selectedNamespace: null, repos: [], selectedRepoIds: [], diffs: [], repoStats: {} });
    },

    goToPlugins: () => {
      set({ step: "plugins" });
    },

    goToHistory: async() => {
      const entries = await window.api.listHistory();
      set({ historyEntries: entries, step: "history" });
    },

    loadRepos: async(namespace: Namespace) => {
      set({ isLoading: true, error: null });

      try {
        const repos = await window.api.loadRepos(namespace.name, namespace.provider);

        set((state) => {
          return {
            step: "repos",
            selectedNamespace: namespace,
            repos,
            selectedRepoIds: repos.map((repo) => repo.id),
            isLoading: false,
            repoStats: {},
            repoCounts: { ...state.repoCounts, [namespace.id]: repos.length },
            activeFilterIds: [],
            filteredRepoIds: null
          };
        });

        void get().loadAllRepoStats();
      }
      catch (loadReposError) {
        set({
          isLoading: false,
          error: ipcErrorMessage(loadReposError, "Failed to load repositories")
        });
      }
    },

    loadAllRepoStats: async() => {
      const { repos, selectedNamespace } = get();

      set({ repoStats: Object.fromEntries(repos.map((repo) => [repo.id, "loading" as const])) });

      for (let i = 0; i < repos.length; i += kConcurrency) {
        const batch = repos.slice(i, i + kConcurrency);
        await Promise.all(
          batch.map(async(repo) => {
            try {
              const stats = await window.api.getRepoStats(repo.fullPath, selectedNamespace!.provider);
              set((state) => {
                return { repoStats: { ...state.repoStats, [repo.id]: stats } };
              });
            }
            catch {
              set((state) => {
                return { repoStats: { ...state.repoStats, [repo.id]: null } };
              });
            }
          })
        );
      }
    },

    toggleRepo: (id: string) => {
      const { selectedRepoIds } = get();
      const isSelected = selectedRepoIds.includes(id);

      set({
        selectedRepoIds: isSelected
          ? selectedRepoIds.filter((repoId) => repoId !== id)
          : [...selectedRepoIds, id]
      });
    },

    selectAll: () => {
      const { repos, filteredRepoIds } = get();
      set({ selectedRepoIds: filteredRepoIds ?? repos.map((repo) => repo.id) });
    },

    deselectAll: () => {
      set({ selectedRepoIds: [] });
    },

    toggleFilter: async(filterId: string) => {
      const { activeFilterIds, repos } = get();
      const isActive = activeFilterIds.includes(filterId);
      const newActiveFilterIds = isActive
        ? activeFilterIds.filter((id) => id !== filterId)
        : [...activeFilterIds, filterId];

      set({ activeFilterIds: newActiveFilterIds });

      if (newActiveFilterIds.length === 0) {
        set({ filteredRepoIds: null });

        return;
      }

      set({ isFilteringRepos: true });
      try {
        const passingIds = await window.api.filterRepos(repos, newActiveFilterIds, get().selectedNamespace!.provider);
        set({ filteredRepoIds: passingIds, isFilteringRepos: false });
      }
      catch {
        set({ isFilteringRepos: false });
      }
    },

    clearFilters: () => {
      set({ activeFilterIds: [], filteredRepoIds: null });
    },

    proceedToPickOperation: () => {
      set({ step: "pick-operation" });
    },

    backToPickOperation: () => {
      set({ step: "pick-operation", diffs: [] });
    },

    setSelectedOperation: (id: string) => {
      set({ selectedOperationId: id, operationInputs: {}, operationOverrides: {} });
    },

    setOperationInputs: (inputs: Record<string, unknown>) => {
      set({ operationInputs: inputs });
    },

    setOperationOverrides: (overrides: Partial<OperationOverrides>) => {
      set((state) => {
        return { operationOverrides: { ...state.operationOverrides, ...overrides } };
      });
    },

    openApplyModal: async(target: "single" | "all", repoPath?: string) => {
      const { selectedOperationId, operationInputs } = get();
      const defaults = await window.api.getOperationDefaults(selectedOperationId, operationInputs);
      set({
        applyModalTarget: target,
        applyModalRepoPath: repoPath ?? null,
        operationOverrides: defaults,
        branchConflictStrategy: null
      });
    },

    closeApplyModal: () => {
      set({ applyModalTarget: null, applyModalRepoPath: null });
    },

    confirmApply: async() => {
      const { applyModalTarget, applyModalRepoPath, operationOverrides, diffs, selectedNamespace } = get();
      set({ applyModalTarget: null, applyModalRepoPath: null });

      if (applyModalTarget === null) {
        return;
      }

      const branchName = operationOverrides.branchName ?? "";
      const repoPaths = applyModalTarget === "all"
        ? diffs.filter((diff) => diff.applyStatus === applyStatus.Pending).map((diff) => diff.repo.fullPath)
        : [applyModalRepoPath!];

      const conflictingPaths = await window.api.checkBranchConflicts(repoPaths, branchName, selectedNamespace!.provider);

      if (conflictingPaths.length > 0) {
        set({
          branchConflictModal: {
            conflictingPaths,
            applyTarget: applyModalTarget!,
            applyRepoPath: applyModalRepoPath
          }
        });

        return;
      }

      if (applyModalTarget === "single" && applyModalRepoPath !== null) {
        await get().applyDiff(applyModalRepoPath);
      }
      else if (applyModalTarget === "all") {
        await get().applyAll();
      }
    },

    closeBranchConflictModal: () => {
      set({ branchConflictModal: null });
    },

    resolveBranchConflict: async(strategy, suffix) => {
      const { branchConflictModal } = get();
      if (branchConflictModal === null) {
        return;
      }

      const { conflictingPaths, applyTarget, applyRepoPath } = branchConflictModal;
      set({ branchConflictModal: null });

      if (strategy === "skip") {
        set((state) => {
          return {
            diffs: state.diffs.map((diff) => {
              if (!conflictingPaths.includes(diff.repo.fullPath)) {
                return diff;
              }

              return { ...diff, applyStatus: applyStatus.Skipped };
            })
          };
        });
      }
      else {
        set({ branchConflictStrategy: { strategy, conflictingPaths, suffix } });
      }

      try {
        if (applyTarget === "single" && applyRepoPath !== null) {
          if (strategy === "skip" && conflictingPaths.includes(applyRepoPath)) {
            return;
          }
          await get().applyDiff(applyRepoPath);
        }
        else if (applyTarget === "all") {
          await get().applyAll();
        }
      }
      finally {
        set({ branchConflictStrategy: null });
      }
    },

    scanRepos: async() => {
      const { repos, selectedRepoIds, selectedOperationId, operationInputs, selectedNamespace } = get();

      set({ isLoading: true, error: null });

      try {
        const selectedRepos = repos.filter((repo) => selectedRepoIds.includes(repo.id));
        const baseDiffs = await window.api.scanRepos(
          selectedRepos,
          selectedOperationId,
          { inputs: operationInputs, provider: selectedNamespace!.provider }
        );
        const diffs: RepoDiff[] = baseDiffs.map((diff) => {
          return {
            ...diff,
            applyStatus: applyStatus.Pending
          };
        });

        set({ step: "diffs", diffs, isLoading: false });
      }
      catch (scanError) {
        set({ isLoading: false, error: ipcErrorMessage(scanError, "Failed to scan repositories") });
      }
    },

    applyDiff: async(repoPath: string) => {
      const {
        diffs, operationInputs, operationOverrides, selectedOperationId, branchConflictStrategy, selectedNamespace
      } = get();

      const diffIndex = diffs.findIndex((diff) => diff.repo.fullPath === repoPath);
      if (diffIndex === -1) {
        return;
      }

      const diff = diffs[diffIndex];

      const isConflicting = branchConflictStrategy?.conflictingPaths.includes(repoPath) ?? false;
      const force = isConflicting && branchConflictStrategy?.strategy === "force";

      let effectiveOverrides = operationOverrides;
      if (isConflicting && branchConflictStrategy?.strategy === "suffix") {
        effectiveOverrides = {
          ...operationOverrides,
          branchName: (operationOverrides.branchName ?? "") + (branchConflictStrategy.suffix ?? "-v2")
        };
      }

      set((state) => {
        const updatedDiffs = [...state.diffs];
        updatedDiffs[diffIndex] = { ...diff, applyStatus: applyStatus.Applying };

        return { diffs: updatedDiffs };
      });

      try {
        const result: SubmitResult = await window.api.applyDiff(
          diff,
          {
            inputs: operationInputs,
            operationId: selectedOperationId,
            overrides: effectiveOverrides,
            force,
            provider: selectedNamespace!.provider
          }
        );

        set((state) => {
          const updatedDiffs = [...state.diffs];
          updatedDiffs[diffIndex] = { ...diff, applyStatus: applyStatus.Done, prUrl: result.prUrl };

          return { diffs: updatedDiffs };
        });
      }
      catch (applyError) {
        set((state) => {
          const updatedDiffs = [...state.diffs];
          updatedDiffs[diffIndex] = {
            ...diff,
            applyStatus: applyStatus.Error,
            error: ipcErrorMessage(applyError, "Failed to create PR")
          };

          return { diffs: updatedDiffs };
        });
      }
    },

    applyAll: async() => {
      const { diffs, selectedOperationId, selectedNamespace } = get();
      const pendingDiffs = diffs.filter((diff) => diff.applyStatus === applyStatus.Pending);

      applyAllAbortController = new AbortController();
      const { signal } = applyAllAbortController;
      set({ isApplyingAll: true });

      try {
        for (let i = 0; i < pendingDiffs.length; i += kApplyConcurrency) {
          if (signal.aborted) {
            break;
          }
          const batch = pendingDiffs.slice(i, i + kApplyConcurrency);
          await Promise.all(batch.map((diff) => get().applyDiff(diff.repo.fullPath)));
        }
      }
      finally {
        applyAllAbortController = null;

        const completedDiffs = get().diffs;
        const results: HistoryEntryResult[] = completedDiffs.flatMap((diff) => {
          if (diff.applyStatus !== applyStatus.Done && diff.applyStatus !== applyStatus.Error) {
            return [];
          }

          return [{
            repoName: diff.repo.name,
            repoFullPath: diff.repo.fullPath,
            status: diff.applyStatus === applyStatus.Done ? "done" as const : "error" as const,
            prUrl: diff.prUrl,
            error: diff.error
          }];
        });

        if (results.length > 0) {
          await window.api.recordRun({
            operationId: selectedOperationId,
            namespace: selectedNamespace?.displayName ?? "",
            results
          });
        }

        set({ isApplyingAll: false, step: "results" });
      }
    },

    cancelApplyAll: () => {
      applyAllAbortController?.abort();
    },

    reset: () => {
      set(kInitialState);
      void get().autoLogin();
    }
  };
});
