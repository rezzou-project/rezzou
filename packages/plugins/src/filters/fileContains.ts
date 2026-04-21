// Import Third-party Dependencies
import { defineFilter, type RepoFilter } from "@rezzou/sdk";

export function fileContains(path: string, search: string): RepoFilter {
  return defineFilter({
    id: "file-contains",
    name: "File Contains",
    description: `${path} contains "${search}"`,
    test: async(ctx) => {
      const content = await ctx.readFile(path);

      return content !== null && content.includes(search);
    }
  });
}
