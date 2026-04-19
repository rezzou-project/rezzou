// Import Internal Dependencies
import type { ProviderAdapter, Operation, OperationOverrides, Repo, RepoDiff, SubmitResult } from "./types.ts";
import { ApiRepoContext } from "./context.ts";

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
