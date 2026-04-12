// Import Internal Dependencies
import type { ProviderAdapter, Operation, Repo, RepoDiff, SubmitResult } from "./types.ts";

export async function scanRepos(
  adapter: ProviderAdapter,
  repos: Repo[],
  operation: Operation
): Promise<RepoDiff[]> {
  const diffs: RepoDiff[] = [];

  for (const repo of repos) {
    const fileContent = await adapter.getFile(repo.fullPath, operation.filePath, repo.defaultBranch);
    if (fileContent === null) {
      continue;
    }

    const updated = operation.apply(fileContent.content);
    if (updated === null) {
      continue;
    }

    diffs.push({
      repo,
      filePath: operation.filePath,
      original: fileContent.content,
      updated
    });
  }

  return diffs;
}

export async function applyRepoDiff(
  adapter: ProviderAdapter,
  diff: RepoDiff,
  operation: Operation
): Promise<SubmitResult> {
  return adapter.submitChanges({
    repoPath: diff.repo.fullPath,
    baseBranch: diff.repo.defaultBranch,
    headBranch: operation.branchName,
    commitMessage: operation.commitMessage,
    prTitle: operation.prTitle,
    prDescription: operation.prDescription,
    files: [{ action: "update", path: diff.filePath, content: diff.updated }]
  });
}
