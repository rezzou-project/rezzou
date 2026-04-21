// Import Third-party Dependencies
import { defineOperation, type RepoContext } from "@rezzou/sdk";

interface RenameFileInputs extends Record<string, unknown> {
  from: string;
  to: string;
}

export const renameFileOperation = defineOperation<RenameFileInputs>({
  id: "rename-file",
  name: "Rename File",
  description: "Rename (move) a file in repositories if it exists",
  inputs: [
    {
      name: "from",
      label: "Source path",
      type: "string" as const,
      required: true,
      placeholder: "e.g. CHANGELOG.md"
    },
    {
      name: "to",
      label: "Destination path",
      type: "string" as const,
      required: true,
      placeholder: "e.g. docs/CHANGELOG.md"
    }
  ],

  async apply(ctx: RepoContext, inputs: RenameFileInputs) {
    const { from, to } = inputs;

    const content = await ctx.readFile(from);
    if (content === null) {
      return null;
    }

    const destinationExists = await ctx.exists(to);
    if (destinationExists) {
      return null;
    }

    return [
      { action: "create" as const, path: to, content },
      { action: "delete" as const, path: from, content: "" }
    ];
  },

  branchName: (inputs: RenameFileInputs) => `rezzou/rename-file-${slugify(inputs.from)}-to-${slugify(inputs.to)}`,
  commitMessage: (inputs: RenameFileInputs) => `chore: rename ${inputs.from} to ${inputs.to}`,
  prTitle: (inputs: RenameFileInputs) => `chore: rename ${inputs.from} to ${inputs.to}`,
  prDescription: (inputs: RenameFileInputs) => `Automated rename of \`${inputs.from}\` to \`${inputs.to}\`, performed by Rezzou.`
});

function slugify(filePath: string): string {
  return filePath.replace(/[/.]/g, "-").replace(/^-+|-+$/g, "");
}
