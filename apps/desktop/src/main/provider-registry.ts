// Import Node.js Dependencies
import * as events from "node:events";

// Import Third-party Dependencies
import { GitHubAdapter, GitLabAdapter } from "@rezzou/providers";
import type { ProviderAdapter, ProviderDescriptor } from "@rezzou/core";

// Import Internal Dependencies
import type { ProviderInfo } from "../shared/ipc-channels.ts";

export type { ProviderInfo };

const kBuiltinDescriptors: ProviderDescriptor[] = [
  {
    provider: "github",
    name: "GitHub",
    create: (token: string): ProviderAdapter => new GitHubAdapter(token)
  },
  {
    provider: "gitlab",
    name: "GitLab",
    create: (token: string): ProviderAdapter => new GitLabAdapter(token)
  }
];

class ProviderRegistry extends events.EventEmitter {
  #providers = new Map<string, ProviderDescriptor>(
    kBuiltinDescriptors.map((d) => [d.provider, d])
  );

  register(descriptor: ProviderDescriptor): void {
    if (this.#providers.has(descriptor.provider)) {
      throw new Error(`Provider ID collision: "${descriptor.provider}" is already registered`);
    }
    this.#providers.set(descriptor.provider, descriptor);
    this.emit("change");
  }

  unregister(provider: string): void {
    this.#providers.delete(provider);
    this.emit("change");
  }

  list(): ProviderInfo[] {
    return [...this.#providers.values()].map((d) => {
      return { provider: d.provider, name: d.name };
    });
  }

  get(provider: string): ProviderDescriptor | undefined {
    return this.#providers.get(provider);
  }
}

export const providerRegistry = new ProviderRegistry();
