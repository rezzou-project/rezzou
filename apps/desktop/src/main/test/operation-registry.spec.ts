// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Operation } from "@rezzou/core";

// Import Internal Dependencies
import { registry, getOperation, listOperations } from "../operation-registry.ts";

// CONSTANTS
const kFakeOperation = {
  id: "fake-op",
  name: "Fake Op",
  description: "A fake operation for testing",
  apply: async() => null,
  branchName: () => "fake-branch",
  commitMessage: () => "fake commit",
  prTitle: () => "fake PR",
  prDescription: () => "fake description"
} satisfies Operation;

describe("registry.register", () => {
  it("should add the operation to the registry", () => {
    registry.register(kFakeOperation);

    assert.equal(registry.get("fake-op").id, "fake-op");
    registry.unregister("fake-op");
  });

  it("should emit a change event", () => {
    let callCount = 0;
    registry.once("change", () => {
      callCount++;
    });

    registry.register(kFakeOperation);
    assert.equal(callCount, 1);

    registry.unregister("fake-op");
  });
});

describe("registry.unregister", () => {
  it("should remove the operation from the registry", () => {
    registry.register(kFakeOperation);
    registry.unregister("fake-op");

    assert.throws(
      () => registry.get("fake-op"),
      { message: "Unknown operation: \"fake-op\"" }
    );
  });

  it("should emit a change event", () => {
    registry.register(kFakeOperation);

    let callCount = 0;
    registry.once("change", () => {
      callCount++;
    });

    registry.unregister("fake-op");
    assert.equal(callCount, 1);
  });
});

describe("registry.list", () => {
  it("should return id, name, and description for each operation", () => {
    const ops = registry.list();

    assert.ok(ops.length > 0);
    for (const op of ops) {
      assert.equal(typeof op.id, "string");
      assert.equal(typeof op.name, "string");
      assert.equal(typeof op.description, "string");
    }
  });

  it("should include registered operations", () => {
    registry.register(kFakeOperation);

    const ops = registry.list();
    assert.ok(ops.some((op) => op.id === "fake-op"));

    registry.unregister("fake-op");
  });
});

describe("registry.get", () => {
  it("should return the operation by id", () => {
    assert.equal(registry.get("license-year").id, "license-year");
  });

  it("should throw for an unknown id", () => {
    assert.throws(
      () => registry.get("unknown-op"),
      { message: "Unknown operation: \"unknown-op\"" }
    );
  });
});

describe("listOperations", () => {
  it("should return the same entries as registry.list()", () => {
    assert.deepEqual(listOperations(), registry.list());
  });
});

describe("getOperation", () => {
  it("should return the operation by id", () => {
    assert.equal(getOperation("license-year").id, "license-year");
  });

  it("should throw for an unknown id", () => {
    assert.throws(
      () => getOperation("unknown-op"),
      { message: "Unknown operation: \"unknown-op\"" }
    );
  });
});
