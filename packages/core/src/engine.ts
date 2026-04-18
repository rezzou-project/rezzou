// Import Internal Dependencies
import type {
  ProviderAdapter, Operation, OperationOverrides, Repo, RepoDiff, SubmitResult, RepoContext, Provider
} from "./types.ts";

class ApiRepoContext implements RepoContext {
  readonly repo: Repo;
  readonly provider: Provider;

  #adapter: ProviderAdapter;
  #cache: Map<string, string | null> = new Map();

  constructor(adapter: ProviderAdapter, repo: Repo) {
    this.#adapter = adapter;
    this.repo = repo;
    this.provider = adapter.provider;
  }

  async readFile(path: string): Promise<string | null> {
    if (this.#cache.has(path)) {
      return this.#cache.get(path)!;
    }

    const result = await this.#adapter.getFile(this.repo.fullPath, path, this.repo.defaultBranch);
    const content = result?.content ?? null;
    this.#cache.set(path, content);

    return content;
  }

  async listFiles(_glob: string): Promise<string[]> {
    throw new Error("listFiles requires listTree provider support");
  }

  async exists(path: string): Promise<boolean> {
    return await this.readFile(path) !== null;
  }
}

export async function scanRepos<I extends Record<string, unknown>>(
  adapter: ProviderAdapter,
  repos: Repo[],
  options: { operation: Operation<I>; inputs: I; }
): Promise<RepoDiff[]> {
  const { operation, inputs } = options;
  const diffs: RepoDiff[] = [];

  for (const repo of repos) {
    const ctx = new ApiRepoContext(adapter, repo);
    const patches = await operation.apply(ctx, inputs);
    if (patches === null || patches.length === 0) {
      continue;
    }

    const originals: Record<string, string> = {};
    for (const patch of patches) {
      if (patch.action !== "create") {
        const content = await ctx.readFile(patch.path);
        if (content !== null) {
          originals[patch.path] = content;
        }
      }
    }

    diffs.push({ repo, patches, originals });
  }

  return diffs;
}

export async function applyRepoDiff<I extends Record<string, unknown>>(
  adapter: ProviderAdapter,
  diff: RepoDiff,
  options: { operation: Operation<I>; inputs: I; overrides?: OperationOverrides; }
): Promise<SubmitResult> {
  const { operation, inputs, overrides } = options;

  return adapter.submitChanges({
    repoPath: diff.repo.fullPath,
    baseBranch: diff.repo.defaultBranch,
    headBranch: overrides?.branchName ?? operation.branchName(inputs),
    commitMessage: overrides?.commitMessage ?? operation.commitMessage(inputs),
    prTitle: overrides?.prTitle ?? operation.prTitle(inputs),
    prDescription: overrides?.prDescription ?? operation.prDescription(inputs),
    reviewers: overrides?.reviewers ?? [],
    files: diff.patches.map((patch) => {
      return {
        action: patch.action,
        path: patch.path,
        content: patch.content ?? ""
      };
    })
  });
}
