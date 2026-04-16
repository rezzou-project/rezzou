// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { defineOperation } from "../defineOperation.ts";

describe("defineOperation", () => {
  it("should return the operation unchanged", () => {
    const op = {
      id: "test-op",
      name: "Test Op",
      description: "A test operation",
      filePath: "test.txt",
      apply: (content: string) => content || null
    };

    const result = defineOperation(op);

    assert.strictEqual(result, op);
  });
});
