// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ZodError } from "zod";

// Import Internal Dependencies
import { parsePlugin } from "../pluginSchema.ts";

// CONSTANTS
const kValidOperation = {
  id: "op-1",
  name: "My Operation",
  description: "Does something useful",
  apply: async() => null,
  branchName: () => "my-branch",
  commitMessage: () => "my commit",
  prTitle: () => "My PR",
  prDescription: () => "My PR description"
};

const kValidPlugin = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  operations: [kValidOperation]
};

describe("parsePlugin", () => {
  it("should parse a valid plugin", () => {
    const plugin = parsePlugin(kValidPlugin);

    assert.equal(plugin.id, "my-plugin");
    assert.equal(plugin.name, "My Plugin");
    assert.equal(plugin.version, "1.0.0");
    assert.equal(plugin.operations.length, 1);
  });

  it("should accept a plugin with optional fields", () => {
    const plugin = parsePlugin({
      ...kValidPlugin,
      filters: [],
      contributions: {
        translations: {
          fr: { hello: "bonjour" }
        }
      }
    });

    assert.deepEqual(plugin.filters, []);
    assert.deepEqual(plugin.contributions?.translations?.fr, { hello: "bonjour" });
  });

  it("should throw ZodError when value is null", () => {
    assert.throws(
      () => parsePlugin(null),
      (error) => error instanceof ZodError
    );
  });

  it("should throw ZodError when id is missing", () => {
    const { id: _id, ...withoutId } = kValidPlugin;

    assert.throws(
      () => parsePlugin(withoutId),
      (error) => error instanceof ZodError
    );
  });

  it("should throw ZodError when name is wrong type", () => {
    assert.throws(
      () => parsePlugin({ ...kValidPlugin, name: 42 }),
      (error) => error instanceof ZodError
    );
  });

  it("should throw ZodError when operations is not an array", () => {
    assert.throws(
      () => parsePlugin({ ...kValidPlugin, operations: "not-an-array" }),
      (error) => error instanceof ZodError
    );
  });

  it("should throw ZodError when operation is missing required functions", () => {
    const incompleteOperation = { id: "op-1", name: "My Op", description: "Desc" };

    assert.throws(
      () => parsePlugin({ ...kValidPlugin, operations: [incompleteOperation] }),
      (error) => error instanceof ZodError
    );
  });

  it("should throw ZodError when operation.apply is not a function", () => {
    const badOperation = { ...kValidOperation, apply: "not-a-function" };

    assert.throws(
      () => parsePlugin({ ...kValidPlugin, operations: [badOperation] }),
      (error) => error instanceof ZodError
    );
  });
});
