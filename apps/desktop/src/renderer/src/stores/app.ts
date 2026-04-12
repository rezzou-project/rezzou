// Import Third-party Dependencies
import { create } from "zustand";

// Import Internal Dependencies
import { GitLabAdapter } from "@rezzou/providers";
import { licenseYearOperation } from "@rezzou/operations";
import {
  scanRepos as engineScanRepos,
  applyRepoDiff,
  type ProviderAdapter,
  type Repo,
  type RepoDiff as BaseRepoDiff
} from "@rezzou/core";

type Step = "connect" | "repos" | "diffs" | "results";

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
  adapter: ProviderAdapter | null;
  groupPath: string;
  repos: Repo[];
  selectedRepoIds: string[];
  diffs: RepoDiff[];
  isLoading: boolean;
  error: string | null;
}

interface AppActions {
  connect: (token: string, groupPath: string) => Promise<void>;
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
  adapter: null,
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

    connect: async(token: string, groupPath: string) => {
      set({ isLoading: true, error: null });

      try {
        const adapter = new GitLabAdapter(token);
        const repos = await adapter.listRepos(groupPath);

        set({
          step: "repos",
          adapter,
          groupPath,
          repos,
          selectedRepoIds: repos.map((repo) => repo.id),
          isLoading: false
        });
      }
      catch (connectError) {
        set({
          isLoading: false,
          error: connectError instanceof Error ? connectError.message : "Failed to connect to GitLab"
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
      const { adapter, repos, selectedRepoIds } = get();
      if (adapter === null) {
        return;
      }

      set({ isLoading: true, error: null });

      const selectedRepos = repos.filter((repo) => selectedRepoIds.includes(repo.id));
      const baseDiffs = await engineScanRepos(adapter, selectedRepos, licenseYearOperation);
      const diffs: RepoDiff[] = baseDiffs.map((diff) => {
        return {
          ...diff,
          applyStatus: applyStatus.Pending
        };
      });

      set({ step: "diffs", diffs, isLoading: false });
    },

    applyDiff: async(repoPath: string) => {
      const { adapter, diffs } = get();
      if (adapter === null) {
        return;
      }

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
        const result = await applyRepoDiff(adapter, diff, licenseYearOperation);

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
            error: applyError instanceof Error ? applyError.message : "Failed to create MR"
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
