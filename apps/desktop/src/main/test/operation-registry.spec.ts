// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OPERATION_REGISTRY, getOperation } from "../operation-registry.ts";

describe("OPERATION_REGISTRY", () => {
  it("should contain the license-year operation by default", () => {
    assert.ok(OPERATION_REGISTRY.has("license-year"));
  });
});

describe("getOperation", () => {
  it("should return the operation for a known id", () => {
    const operation = getOperation("license-year");

    assert.equal(operation.filePath, "LICENSE");
  });

  it("should throw for an unknown id", () => {
    assert.throws(
      () => getOperation("unknown-op"),
      { message: "Unknown operation: \"unknown-op\"" }
    );
  });
});
