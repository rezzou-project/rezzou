// Import Third-party Dependencies
import { z } from "zod";

// Import Internal Dependencies
import type { Plugin } from "./types.js";

// CONSTANTS
const kFunctionSchema = z.custom<(...args: unknown[]) => unknown>(
  (val) => typeof val === "function",
  "Expected a function"
);

const kOperationSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  inputs: z.array(z.looseObject({})).optional(),
  apply: kFunctionSchema,
  branchName: kFunctionSchema,
  commitMessage: kFunctionSchema,
  prTitle: kFunctionSchema,
  prDescription: kFunctionSchema
});

const kRepoFilterSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  test: kFunctionSchema
});

const kProviderDescriptorSchema = z.looseObject({
  provider: z.string(),
  name: z.string(),
  create: kFunctionSchema
});

const kPluginContributionsSchema = z.looseObject({
  translations: z.record(z.string(), z.record(z.string(), z.string())).optional()
});

export const pluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  operations: z.array(kOperationSchema),
  filters: z.array(kRepoFilterSchema).optional(),
  providers: z.array(kProviderDescriptorSchema).optional(),
  contributions: kPluginContributionsSchema.optional()
});

export function parsePlugin(value: unknown): Plugin {
  return pluginSchema.parse(value) as Plugin;
}
