// Import Third-party Dependencies
import { defineOperation, type RepoContext } from "@rezzou/sdk";

interface ReplacePatternInputs extends Record<string, unknown> {
  path: string;
  pattern: string;
  flags: string;
  replacement: string;
}

export const replacePatternOperation = defineOperation<ReplacePatternInputs>({
  id: "replace-pattern",
  name: "Replace Pattern",
  description: "Replace a regex pattern in a file across repositories",
  inputs: [
    {
      name: "path",
      label: "File path",
      type: "string" as const,
      required: true,
      placeholder: "e.g. README.md"
    },
    {
      name: "pattern",
      label: "Pattern (regex)",
      type: "string" as const,
      required: true,
      placeholder: "e.g. Copyright \\d{4}"
    },
    {
      name: "flags",
      label: "Regex flags",
      type: "string" as const,
      default: "g",
      placeholder: "e.g. g, gi, gm"
    },
    {
      name: "replacement",
      label: "Replacement",
      type: "string" as const,
      required: true,
      placeholder: "e.g. Copyright 2025"
    }
  ],

  async apply(ctx: RepoContext, inputs: ReplacePatternInputs) {
    const { path, pattern, flags, replacement } = inputs;

    const content = await ctx.readFile(path);
    if (content === null) {
      return null;
    }

    const regex = new RegExp(pattern, flags);
    const updated = content.replace(regex, replacement);
    if (updated === content) {
      return null;
    }

    return [{ action: "update" as const, path, content: updated }];
  },

  branchName: (inputs: ReplacePatternInputs) => `rezzou/replace-pattern-${slugify(inputs.path)}`,
  commitMessage: (inputs: ReplacePatternInputs) => `chore: replace pattern in ${inputs.path}`,
  prTitle: (inputs: ReplacePatternInputs) => `chore: replace pattern in ${inputs.path}`,
  prDescription: (
    inputs: ReplacePatternInputs
  ) => `Automated replacement of \`${inputs.pattern}\` in \`${inputs.path}\`, performed by Rezzou.`
});

function slugify(filePath: string): string {
  return filePath.replace(/[/.]/g, "-").replace(/^-+|-+$/g, "");
}
