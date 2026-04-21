// Import Third-party Dependencies
import { defineFilter, type RepoFilter } from "@rezzou/sdk";

export function hasFile(path: string): RepoFilter {
  return defineFilter({
    id: "has-file",
    name: "Has File",
    description: `Repository contains ${path}`,
    test: (ctx) => ctx.exists(path)
  });
}
