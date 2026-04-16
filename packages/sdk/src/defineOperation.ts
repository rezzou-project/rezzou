// Import Third-party Dependencies
import type { Operation } from "@rezzou/core";

/**
 * Helper to define a Rezzou operation with full type checking.
 *
 * @example
 * ```ts
 * import { defineOperation } from "@rezzou/sdk";
 *
 * export const myOperation = defineOperation({
 *   id: "my-operation",
 *   name: "My Operation",
 *   description: "Does something useful",
 *   filePath: "some-file.txt",
 *   apply(content) {
 *     if (content.includes("already done")) return null;
 *     return content + "\n# added by my-operation";
 *   }
 * });
 * ```
 */
export function defineOperation(operation: Operation): Operation {
  return operation;
}
