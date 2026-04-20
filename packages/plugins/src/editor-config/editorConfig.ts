// Import Third-party Dependencies
import { defineOperation, type RepoContext } from "@rezzou/sdk";

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

export const editorConfigOperation = defineOperation({
  id: "editorconfig",
  name: "EditorConfig",
  description: "Drop a standard .editorconfig if none exists",
  inputs: [],

  async apply(ctx: RepoContext, _inputs: Record<string, unknown>) {
    const content = await ctx.readFile(".editorconfig");
    if (content !== null && content.length > 0) {
      return null;
    }

    return [
      {
        action: content === null ? "create" : "update",
        path: ".editorconfig",
        content: kTemplate
      }
    ];
  },

  branchName: () => "rezzou/editorconfig",
  commitMessage: () => "chore: add .editorconfig",
  prTitle: () => "chore: add .editorconfig",
  prDescription: () => "Automated creation of a standard .editorconfig, performed by Rezzou."
});
