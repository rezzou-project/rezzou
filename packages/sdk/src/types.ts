// Import Third-party Dependencies
import type { Operation, RepoFilter, ProviderAdapter } from "@rezzou/core";

export interface PluginContributions {
  translations?: Record<string, Record<string, string>>;
}

export interface Plugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly operations: Operation[];
  readonly filters?: RepoFilter[];
  readonly providers?: ProviderAdapter[];
  readonly contributions?: PluginContributions;
}
