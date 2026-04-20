// Import Third-party Dependencies
import { defineOperation, type RepoContext } from "@rezzou/sdk";

// CONSTANTS
const kRequiredEntries = [
  ".temp",
  ".vscode/",
  "dist/",
  "node_modules/",
  ".DS_Store",
  "*.log"
];

export const gitignoreMaintainerOperation = defineOperation({
  id: "gitignore-maintainer",
  name: "Gitignore Maintainer",
  description: "Ensure common entries are present in .gitignore without altering existing content",
  inputs: [],

  async apply(ctx: RepoContext, _inputs: Record<string, unknown>) {
    const raw = await ctx.readFile(".gitignore");
    const content = raw ?? "";

    const existingLines = new Set(
      content.split("\n").flatMap((line) => {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          return [];
        }

        return trimmed;
      })
    );

    const missing = kRequiredEntries.filter((entry) => !existingLines.has(entry));
    if (missing.length === 0) {
      return null;
    }

    let updated: string;
    if (content === "") {
      updated = missing.join("\n");
    }
    else {
      const separator = content.endsWith("\n") ? "" : "\n";
      updated = content + separator + missing.join("\n");
    }

    return [
      {
        action: raw === null ? "create" : "update",
        path: ".gitignore",
        content: updated
      }
    ];
  },

  branchName: () => "rezzou/gitignore-maintainer",
  commitMessage: () => "chore: update .gitignore",
  prTitle: () => "chore: update .gitignore",
  prDescription: () => "Automated update of .gitignore to include common entries, performed by Rezzou."
});
