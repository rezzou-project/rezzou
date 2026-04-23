// Import Third-party Dependencies
import { defineOperation, type RepoContext } from "@rezzou/sdk";

interface AddFileInputs extends Record<string, unknown> {
  path: string;
  content: string;
  overwrite?: boolean;
}

export const addFileOperation = defineOperation<AddFileInputs>({
  id: "add-file",
  name: "Add File",
  description: "Create a file in repositories, optionally overwriting if it already exists",
  inputs: [
    {
      name: "path",
      label: "File path",
      type: "string" as const,
      required: true,
      placeholder: "e.g. .github/CODEOWNERS"
    },
    {
      name: "content",
      label: "File content",
      type: "file-content" as const,
      required: true,
      relatedPathField: "path"
    },
    {
      name: "overwrite",
      label: "Overwrite if exists",
      type: "boolean" as const,
      default: false
    }
  ],

  async apply(ctx: RepoContext, inputs: AddFileInputs) {
    const { path, content, overwrite = false } = inputs;

    const existing = await ctx.readFile(path);
    if (existing !== null && !overwrite) {
      return null;
    }

    return [
      {
        action: existing === null ? "create" : "update",
        path,
        content
      }
    ];
  },

  branchName: (inputs: AddFileInputs) => `rezzou/add-file-${slugify(inputs.path)}`,
  commitMessage: (inputs: AddFileInputs) => `chore: add ${inputs.path}`,
  prTitle: (inputs: AddFileInputs) => `chore: add ${inputs.path}`,
  prDescription: (inputs: AddFileInputs) => `Automated addition of \`${inputs.path}\`, performed by Rezzou.`
});

function slugify(filePath: string): string {
  return filePath.replace(/[/.]/g, "-").replace(/^-+|-+$/g, "");
}
