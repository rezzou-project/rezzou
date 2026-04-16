// Import Third-party Dependencies
import { licenseYearOperation, gitignoreMaintainerOperation, editorConfigOperation } from "@rezzou/operations";
import type { Operation } from "@rezzou/core";

export const OPERATION_REGISTRY: Map<string, Operation> = new Map([
  ["license-year", licenseYearOperation],
  ["gitignore-maintainer", gitignoreMaintainerOperation],
  ["editorconfig", editorConfigOperation]
]);

export interface OperationInfo {
  id: string;
  name: string;
  description: string;
  filePath: string;
}

export function listOperations(): OperationInfo[] {
  return [...OPERATION_REGISTRY.entries()].map(([id, op]) => {
    return {
      id,
      name: op.name,
      description: op.description,
      filePath: op.filePath
    };
  });
}

export function getOperation(id: string): Operation {
  const operation = OPERATION_REGISTRY.get(id);
  if (operation === undefined) {
    throw new Error(`Unknown operation: "${id}"`);
  }

  return operation;
}
