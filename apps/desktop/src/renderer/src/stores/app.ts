// Import Third-party Dependencies
import { create } from "zustand";
import type { Provider, NamespaceType, Repo, RepoDiff as BaseRepoDiff, SubmitResult } from "@rezzou/core";

type Step = "connect" | "repos" | "diffs" | "results";

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
  Error: "error"
} as const;
type ApplyStatus = (typeof applyStatus)[keyof typeof applyStatus];

export interface RepoDiff extends BaseRepoDiff {
  applyStatus: ApplyStatus;
  prUrl?: string;
  error?: string;
}

interface AppState {
  step: Step;
  provider: Provider;
  namespaceType: NamespaceType;
  groupPath: string;
  repos: Repo[];
  selectedRepoIds: string[];
  diffs: RepoDiff[];
  isLoading: boolean;
  error: string | null;
}

interface AppActions {
  connect: (token: string, groupPath: string, options: { provider: Provider; namespaceType: NamespaceType; }) => Promise<void>;
  toggleRepo: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  scanRepos: () => Promise<void>;
  applyDiff: (repoPath: string) => Promise<void>;
  applyAll: () => Promise<void>;
  reset: () => void;
}

const kInitialState: AppState = {
  step: "connect",
  provider: "gitlab",
  namespaceType: "org",
  groupPath: "",
  repos: [],
  selectedRepoIds: [],
  diffs: [],
  isLoading: false,
  error: null
};

export const useAppStore = create<AppState & AppActions>((set, get) => {
  return {
    ...kInitialState,

    connect: async(token: string, groupPath: string, options: { provider: Provider; namespaceType: NamespaceType; }) => {
      set({ isLoading: true, error: null });

      try {
        const repos = await window.api.connect(token, groupPath, options);

        set({
          step: "repos",
          provider: options.provider,
          namespaceType: options.namespaceType,
          groupPath,
          repos,
          selectedRepoIds: repos.map((repo) => repo.id),
          isLoading: false
        });
      }
      catch (connectError) {
        set({
          isLoading: false,
          error: ipcErrorMessage(connectError, "Failed to connect")
        });
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
      const { repos } = get();
      set({ selectedRepoIds: repos.map((repo) => repo.id) });
    },

    deselectAll: () => {
      set({ selectedRepoIds: [] });
    },

    scanRepos: async() => {
      const { repos, selectedRepoIds } = get();

      set({ isLoading: true, error: null });

      const selectedRepos = repos.filter((repo) => selectedRepoIds.includes(repo.id));
      const baseDiffs = await window.api.scanRepos(selectedRepos);
      const diffs: RepoDiff[] = baseDiffs.map((diff) => {
        return {
          ...diff,
          applyStatus: applyStatus.Pending
        };
      });

      set({ step: "diffs", diffs, isLoading: false });
    },

    applyDiff: async(repoPath: string) => {
      const { diffs } = get();

      const diffIndex = diffs.findIndex((diff) => diff.repo.fullPath === repoPath);
      if (diffIndex === -1) {
        return;
      }

      const diff = diffs[diffIndex];

      set((state) => {
        const updatedDiffs = [...state.diffs];
        updatedDiffs[diffIndex] = { ...diff, applyStatus: applyStatus.Applying };

        return { diffs: updatedDiffs };
      });

      try {
        const result: SubmitResult = await window.api.applyDiff(diff);

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
      const { diffs } = get();
      const pendingDiffs = diffs.filter((diff) => diff.applyStatus === applyStatus.Pending);

      for (const diff of pendingDiffs) {
        await get().applyDiff(diff.repo.fullPath);
      }

      set({ step: "results" });
    },

    reset: () => set(kInitialState)
  };
});
