// Import Third-party Dependencies
import { create } from "zustand";
import type { Provider, Namespace, Repo, RepoDiff as BaseRepoDiff, SubmitResult, OperationOverrides } from "@rezzou/core";

// Import Internal Dependencies
import { licenseYearOperation } from "@rezzou/operations";

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

interface AutoLoginUser {
  displayName: string;
  provider: Provider;
}

interface AppState {
  step: Step;
  provider: Provider;
  autoLoginUser: AutoLoginUser | null;
  namespaces: Namespace[];
  selectedNamespace: Namespace | null;
  repos: Repo[];
  selectedRepoIds: string[];
  diffs: RepoDiff[];
  operationOverrides: OperationOverrides;
  isLoading: boolean;
  error: string | null;
}

interface AppActions {
  autoLogin: () => Promise<void>;
  continueWithSavedAccount: () => void;
  authenticate: (token: string, provider: Provider) => Promise<void>;
  receiveOAuthResult: (namespaces: Namespace[], provider: Provider) => void;
  loadRepos: (namespace: Namespace) => Promise<void>;
  toggleRepo: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  scanRepos: () => Promise<void>;
  setOperationOverrides: (overrides: Partial<OperationOverrides>) => void;
  applyDiff: (repoPath: string) => Promise<void>;
  applyAll: () => Promise<void>;
  reset: () => void;
}

const kInitialState: AppState = {
  step: "connect",
  provider: "gitlab",
  autoLoginUser: null,
  namespaces: [],
  selectedNamespace: null,
  repos: [],
  selectedRepoIds: [],
  diffs: [],
  operationOverrides: {
    branchName: licenseYearOperation.branchName,
    commitMessage: licenseYearOperation.commitMessage,
    prTitle: licenseYearOperation.prTitle,
    prDescription: licenseYearOperation.prDescription,
    reviewers: licenseYearOperation.reviewers
  },
  isLoading: false,
  error: null
};

export const useAppStore = create<AppState & AppActions>((set, get) => {
  return {
    ...kInitialState,

    autoLogin: async() => {
      const result = await window.api.autoLogin();
      if (result !== null) {
        const userNs = result.namespaces.find((ns) => ns.type === "user");
        const autoLoginUser: AutoLoginUser | null = userNs
          ? { displayName: userNs.displayName, provider: result.provider }
          : null;
        set({ provider: result.provider, namespaces: result.namespaces, autoLoginUser });
      }
    },

    continueWithSavedAccount: () => {
      set({ autoLoginUser: null });
    },

    authenticate: async(token: string, provider: Provider) => {
      set({ isLoading: true, error: null });

      try {
        const namespaces = await window.api.authenticate(token, provider);

        set({ provider, namespaces, isLoading: false });
      }
      catch (authenticateError) {
        set({
          isLoading: false,
          error: ipcErrorMessage(authenticateError, "Failed to connect")
        });
      }
    },

    receiveOAuthResult: (namespaces: Namespace[], provider: Provider) => {
      set({ provider, namespaces, isLoading: false, error: null });
    },

    loadRepos: async(namespace: Namespace) => {
      set({ isLoading: true, error: null });

      try {
        const repos = await window.api.loadRepos(namespace.name);

        set({
          step: "repos",
          selectedNamespace: namespace,
          repos,
          selectedRepoIds: repos.map((repo) => repo.id),
          isLoading: false
        });
      }
      catch (loadReposError) {
        set({
          isLoading: false,
          error: ipcErrorMessage(loadReposError, "Failed to load repositories")
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

    setOperationOverrides: (overrides: Partial<OperationOverrides>) => {
      set((state) => {
        return { operationOverrides: { ...state.operationOverrides, ...overrides } };
      });
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
      const { diffs, operationOverrides } = get();

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
        const result: SubmitResult = await window.api.applyDiff(diff, operationOverrides);

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

    reset: () => {
      set(kInitialState);
      void get().autoLogin();
    }
  };
});
