// Import Node.js Dependencies
import * as events from "node:events";

// Import Third-party Dependencies
import { licenseYearOperation, gitignoreMaintainerOperation, editorConfigOperation } from "@rezzou/operations";
import type { Operation } from "@rezzou/core";

export interface OperationInfo {
  id: string;
  name: string;
  description: string;
}

class OperationRegistry extends events.EventEmitter {
  #operations = new Map<string, Operation>([
    [licenseYearOperation.id, licenseYearOperation],
    [gitignoreMaintainerOperation.id, gitignoreMaintainerOperation],
    [editorConfigOperation.id, editorConfigOperation]
  ]);

  register(operation: Operation): void {
    this.#operations.set(operation.id, operation);
    this.emit("change");
  }

  unregister(id: string): void {
    this.#operations.delete(id);
    this.emit("change");
  }

  list(): OperationInfo[] {
    return [...this.#operations.values()].map((op) => {
      return {
        id: op.id,
        name: op.name,
        description: op.description
      };
    });
  }

  get(id: string): Operation {
    const operation = this.#operations.get(id);
    if (operation === undefined) {
      throw new Error(`Unknown operation: "${id}"`);
    }

    return operation;
  }
}

export const registry = new OperationRegistry();

export function listOperations(): OperationInfo[] {
  return registry.list();
}

export function getOperation(id: string): Operation {
  return registry.get(id);
}
