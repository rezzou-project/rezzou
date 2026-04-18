// Import Third-party Dependencies
import type { Operation } from "@rezzou/core";

export function defineOperation<T extends Record<string, unknown>>(operation: Operation<T>): Operation<T> {
  return operation;
}
