// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { InputField } from "@rezzou/core";

// Import Internal Dependencies
import { validateField, getDefaultValues } from "../utils/inputsForm.ts";

describe("UT validateField", () => {
  it("should return null for a valid string field", () => {
    const field: InputField = { name: "path", label: "Path", type: "string", required: true };
    assert.equal(validateField(field, "src/index.ts"), null);
  });

  it("should return an error when a required string field is empty", () => {
    const field: InputField = { name: "path", label: "Path", type: "string", required: true };
    assert.equal(validateField(field, ""), "Path is required");
  });

  it("should return an error when a required field is undefined", () => {
    const field: InputField = { name: "path", label: "Path", type: "string", required: true };
    assert.equal(validateField(field, undefined), "Path is required");
  });

  it("should return null when a non-required field is empty", () => {
    const field: InputField = { name: "flags", label: "Flags", type: "string" };
    assert.equal(validateField(field, ""), null);
  });

  it("should return an error when a string does not match the pattern", () => {
    const field: InputField = { name: "version", label: "Version", type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" };
    assert.equal(validateField(field, "not-a-version"), "Version does not match expected format");
  });

  it("should return null when a string matches the pattern", () => {
    const field: InputField = { name: "version", label: "Version", type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" };
    assert.equal(validateField(field, "1.2.3"), null);
  });

  it("should return an error when a number is below min", () => {
    const field: InputField = { name: "count", label: "Count", type: "number", min: 1 };
    assert.equal(validateField(field, 0), "Count must be at least 1");
  });

  it("should return an error when a number exceeds max", () => {
    const field: InputField = { name: "count", label: "Count", type: "number", max: 10 };
    assert.equal(validateField(field, 11), "Count must be at most 10");
  });

  it("should return null for a number within bounds", () => {
    const field: InputField = { name: "count", label: "Count", type: "number", min: 1, max: 10 };
    assert.equal(validateField(field, 5), null);
  });

  it("should return an error when a required multiselect is empty", () => {
    const field: InputField = {
      name: "tags",
      label: "Tags",
      type: "multiselect",
      required: true,
      options: [{ value: "a", label: "A" }]
    };
    assert.equal(validateField(field, []), "Tags is required");
  });

  it("should return null for a boolean field regardless of value", () => {
    const field: InputField = { name: "enabled", label: "Enabled", type: "boolean" };
    assert.equal(validateField(field, false), null);
    assert.equal(validateField(field, true), null);
  });
});

describe("UT getDefaultValues", () => {
  it("should return field defaults when defined", () => {
    const fields: InputField[] = [
      { name: "flags", label: "Flags", type: "string", default: "g" }
    ];
    assert.deepEqual(getDefaultValues(fields), { flags: "g" });
  });

  it("should default boolean fields to false when no default is provided", () => {
    const fields: InputField[] = [
      { name: "dryRun", label: "Dry Run", type: "boolean" }
    ];
    assert.deepEqual(getDefaultValues(fields), { dryRun: false });
  });

  it("should default multiselect fields to an empty array", () => {
    const fields: InputField[] = [
      { name: "tags", label: "Tags", type: "multiselect", options: [{ value: "a", label: "A" }] }
    ];
    assert.deepEqual(getDefaultValues(fields), { tags: [] });
  });

  it("should omit string/number fields with no default", () => {
    const fields: InputField[] = [
      { name: "path", label: "Path", type: "string", required: true }
    ];
    assert.deepEqual(getDefaultValues(fields), {});
  });

  it("should handle a mix of field types and defaults", () => {
    const fields: InputField[] = [
      { name: "path", label: "Path", type: "string", required: true },
      { name: "flags", label: "Flags", type: "string", default: "g" },
      { name: "enabled", label: "Enabled", type: "boolean" },
      { name: "count", label: "Count", type: "number", default: 5 }
    ];
    assert.deepEqual(getDefaultValues(fields), { flags: "g", enabled: false, count: 5 });
  });
});
