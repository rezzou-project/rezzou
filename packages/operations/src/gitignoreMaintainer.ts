// Import Third-party Dependencies
import type { Operation } from "@rezzou/core";

// CONSTANTS
const kRequiredEntries = [
  ".temp",
  ".vscode/",
  "dist/",
  "node_modules/",
  ".DS_Store",
  "*.log"
];

function applyGitignoreMaintainer(content: string): string | null {
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

  if (content === "") {
    return missing.join("\n");
  }

  const separator = content.endsWith("\n") ? "" : "\n";

  return content + separator + missing.join("\n");
}

export const gitignoreMaintainerOperation = {
  name: "Gitignore Maintainer",
  description: "Ensure common entries are present in .gitignore without altering existing content",
  filePath: ".gitignore",
  branchName: "rezzou/gitignore-maintainer",
  commitMessage: "chore: update .gitignore",
  prTitle: "chore: update .gitignore",
  prDescription: "Automated update of .gitignore to include common entries, performed by Rezzou.",
  reviewers: [],
  apply: applyGitignoreMaintainer
} satisfies Operation;
