// Import Node.js Dependencies
import * as events from "node:events";

// Import Third-party Dependencies
import {
  licenseYearPlugin,
  gitignoreMaintainerPlugin,
  editorConfigPlugin,
  addFilePlugin,
  removeFilePlugin,
  renameFilePlugin,
  replacePatternPlugin
} from "@rezzou/plugins";
import type { Operation } from "@rezzou/core";

// Import Internal Dependencies
import type { OperationInfo } from "../shared/ipc-channels.ts";

export type { OperationInfo };

const kBuiltinOperations = [
  licenseYearPlugin,
  gitignoreMaintainerPlugin,
  editorConfigPlugin,
  addFilePlugin,
  removeFilePlugin,
  renameFilePlugin,
  replacePatternPlugin]
  .flatMap((plugin) => plugin.operations);

class OperationRegistry extends events.EventEmitter {
  #operations = new Map<string, Operation>(
    kBuiltinOperations.map((op) => [op.id, op])
  );

  register(operation: Operation): void {
    if (this.#operations.has(operation.id)) {
      throw new Error(`Operation ID collision: "${operation.id}" is already registered`);
    }
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
        description: op.description,
        inputs: op.inputs
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
