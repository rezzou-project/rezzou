// Import Node.js Dependencies
import { pathToFileURL } from "node:url";

// Import Third-party Dependencies
import type { Plugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { registry as operationRegistry } from "./operation-registry.ts";
import { filterRegistry } from "./filter-registry.ts";

function isPlugin(value: unknown): value is Plugin {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.version === "string" &&
    Array.isArray(obj.operations)
  );
}

export async function loadPlugin(filePath: string): Promise<Plugin> {
  const fileUrl = pathToFileURL(filePath).href;

  let mod: unknown;
  try {
    mod = await import(fileUrl);
  }
  catch (error) {
    throw new Error(`Failed to import plugin from "${filePath}"`, { cause: error });
  }

  const plugin: unknown = (mod as Record<string, unknown>).default ?? mod;
  if (!isPlugin(plugin)) {
    throw new Error("Invalid plugin: missing required fields (id, name, version, operations)");
  }

  for (const operation of plugin.operations) {
    operationRegistry.register(operation);
  }

  for (const filter of plugin.filters ?? []) {
    filterRegistry.register(filter);
  }

  return plugin;
}
