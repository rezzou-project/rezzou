// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OPERATION_REGISTRY, getOperation, listOperations } from "../operation-registry.ts";

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

describe("listOperations", () => {
  it("should return an entry for each registered operation", () => {
    const ops = listOperations();

    assert.equal(ops.length, OPERATION_REGISTRY.size);
  });

  it("should include id, name, and description for each entry", () => {
    const ops = listOperations();
    const licenseYear = ops.find((op) => op.id === "license-year");

    assert.ok(licenseYear !== undefined);
    assert.equal(typeof licenseYear.name, "string");
    assert.equal(typeof licenseYear.description, "string");
    assert.ok(licenseYear.name.length > 0);
    assert.ok(licenseYear.description.length > 0);
  });
});
