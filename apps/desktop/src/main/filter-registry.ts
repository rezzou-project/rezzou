// Import Node.js Dependencies
import * as events from "node:events";

// Import Third-party Dependencies
import type { RepoFilter } from "@rezzou/core";

// Import Internal Dependencies
import type { FilterInfo } from "../shared/ipc-channels.ts";

export type { FilterInfo };

class FilterRegistry extends events.EventEmitter {
  #filters = new Map<string, RepoFilter>();

  register(filter: RepoFilter): void {
    if (this.#filters.has(filter.id)) {
      throw new Error(`Filter ID collision: "${filter.id}" is already registered`);
    }
    this.#filters.set(filter.id, filter);
    this.emit("change");
  }

  unregister(id: string): void {
    this.#filters.delete(id);
    this.emit("change");
  }

  list(): FilterInfo[] {
    return [...this.#filters.values()].map((filter) => {
      return {
        id: filter.id,
        name: filter.name,
        description: filter.description
      };
    });
  }

  get(id: string): RepoFilter {
    const filter = this.#filters.get(id);
    if (filter === undefined) {
      throw new Error(`Unknown filter: "${id}"`);
    }

    return filter;
  }
}

export const filterRegistry = new FilterRegistry();
