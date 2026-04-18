// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OPERATION_REGISTRY, getOperation, listOperations } from "../operation-registry.ts";

describe("OPERATION_REGISTRY", () => {
  it("should contain the license-year operation", () => {
    assert.ok(OPERATION_REGISTRY.has("license-year"));
  });

  it("should contain the gitignore-maintainer operation", () => {
    assert.ok(OPERATION_REGISTRY.has("gitignore-maintainer"));
  });

  it("should contain the editorconfig operation", () => {
    assert.ok(OPERATION_REGISTRY.has("editorconfig"));
  });
});

describe("getOperation", () => {
  it("should return license-year operation with id 'license-year'", () => {
    assert.equal(getOperation("license-year").id, "license-year");
  });

  it("should return gitignore-maintainer operation with id 'gitignore-maintainer'", () => {
    assert.equal(getOperation("gitignore-maintainer").id, "gitignore-maintainer");
  });

  it("should return editorconfig operation with id 'editorconfig'", () => {
    assert.equal(getOperation("editorconfig").id, "editorconfig");
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
