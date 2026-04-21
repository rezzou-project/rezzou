// Import Third-party Dependencies
import { defineFilter, type RepoFilter } from "@rezzou/sdk";

export function defaultBranchIs(branch: string): RepoFilter {
  return defineFilter({
    id: "default-branch-is",
    name: "Default Branch Is",
    description: `Default branch is "${branch}"`,
    test: (ctx) => Promise.resolve(ctx.repo.defaultBranch === branch)
  });
}
