// Import Node.js Dependencies
import { pathToFileURL } from "node:url";

// Import Third-party Dependencies
import { type Plugin, parsePlugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { registry as operationRegistry } from "./operation-registry.ts";
import { filterRegistry } from "./filter-registry.ts";

export async function loadPlugin(filePath: string): Promise<Plugin> {
  const fileUrl = pathToFileURL(filePath).href;

  let mod: unknown;
  try {
    mod = await import(fileUrl);
  }
  catch (error) {
    throw new Error(`Failed to import plugin from "${filePath}"`, { cause: error });
  }

  const raw: unknown = (mod as Record<string, unknown>).default ?? mod;
  const plugin = parsePlugin(raw);

  for (const operation of plugin.operations) {
    operationRegistry.register(operation);
  }

  for (const filter of plugin.filters ?? []) {
    filterRegistry.register(filter);
  }

  return plugin;
}
