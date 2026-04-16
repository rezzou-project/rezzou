// Import Third-party Dependencies
import { licenseYearOperation } from "@rezzou/operations";
import type { Operation } from "@rezzou/core";

export const OPERATION_REGISTRY: Map<string, Operation> = new Map([
  ["license-year", licenseYearOperation]
]);

export function getOperation(id: string): Operation {
  const operation = OPERATION_REGISTRY.get(id);
  if (operation === undefined) {
    throw new Error(`Unknown operation: "${id}"`);
  }

  return operation;
}
