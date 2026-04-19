// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { definePlugin } from "../definePlugin.ts";

describe("definePlugin", () => {
  it("should return the plugin unchanged", () => {
    const plugin = definePlugin({
      id: "my-plugin",
      name: "My Plugin",
      version: "1.0.0",
      operations: []
    });

    assert.equal(plugin.id, "my-plugin");
    assert.equal(plugin.version, "1.0.0");
    assert.deepEqual(plugin.operations, []);
  });

  it("should preserve optional fields", () => {
    const plugin = definePlugin({
      id: "my-plugin",
      name: "My Plugin",
      version: "1.0.0",
      operations: [],
      filters: [],
      contributions: {
        translations: {
          fr: { hello: "bonjour" }
        }
      }
    });

    assert.deepEqual(plugin.contributions?.translations?.fr, { hello: "bonjour" });
  });
});
