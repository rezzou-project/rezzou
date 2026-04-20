// Import Third-party Dependencies
import { defineOperation, type RepoContext } from "@rezzou/sdk";

interface RemoveFileInputs extends Record<string, unknown> {
  path: string;
}

export const removeFileOperation = defineOperation<RemoveFileInputs>({
  id: "remove-file",
  name: "Remove File",
  description: "Delete a file from repositories if it exists",
  inputs: [
    {
      name: "path",
      label: "File path",
      type: "string" as const,
      required: true,
      placeholder: "e.g. .github/CODEOWNERS"
    }
  ],

  async apply(ctx: RepoContext, inputs: RemoveFileInputs) {
    const { path } = inputs;

    const existing = await ctx.readFile(path);
    if (existing === null) {
      return null;
    }

    return [
      {
        action: "delete" as const,
        path,
        content: ""
      }
    ];
  },

  branchName: (inputs: RemoveFileInputs) => `rezzou/remove-file-${slugify(inputs.path)}`,
  commitMessage: (inputs: RemoveFileInputs) => `chore: remove ${inputs.path}`,
  prTitle: (inputs: RemoveFileInputs) => `chore: remove ${inputs.path}`,
  prDescription: (inputs: RemoveFileInputs) => `Automated removal of \`${inputs.path}\`, performed by Rezzou.`
});

function slugify(filePath: string): string {
  return filePath.replace(/[/.]/g, "-").replace(/^-+|-+$/g, "");
}
