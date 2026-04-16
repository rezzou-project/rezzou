// Import Third-party Dependencies
import type { Operation } from "@rezzou/core";

// CONSTANTS
const kTemplate = `root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
charset = utf-8
trim_trailing_whitespace = true
`;

function applyEditorConfig(content: string): string | null {
  if (content.length > 0) {
    return null;
  }

  return kTemplate;
}

export const editorConfigOperation = {
  name: "EditorConfig",
  description: "Drop a standard .editorconfig if none exists",
  filePath: ".editorconfig",
  branchName: "rezzou/editorconfig",
  commitMessage: "chore: add .editorconfig",
  prTitle: "chore: add .editorconfig",
  prDescription: "Automated creation of a standard .editorconfig, performed by Rezzou.",
  reviewers: [],
  apply: applyEditorConfig
} satisfies Operation;
