// Import Third-party Dependencies
import type { InputField } from "@rezzou/core";

export function validateField(field: InputField, value: unknown): string | null {
  const isEmpty = value === undefined || value === null || value === "";
  const isEmptyMultiselect = field.type === "multiselect" && Array.isArray(value) && value.length === 0;

  if (field.required && (isEmpty || isEmptyMultiselect)) {
    return `${field.label} is required`;
  }

  if (field.type === "string" && typeof value === "string" && value !== "" && field.pattern !== undefined) {
    if (!new RegExp(field.pattern).test(value)) {
      return `${field.label} does not match expected format`;
    }
  }

  if (field.type === "number" && typeof value === "number") {
    if (field.min !== undefined && value < field.min) {
      return `${field.label} must be at least ${field.min}`;
    }
    if (field.max !== undefined && value > field.max) {
      return `${field.label} must be at most ${field.max}`;
    }
  }

  return null;
}

export function getDefaultValues(fields: readonly InputField[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.default !== undefined) {
      result[field.name] = field.default;
    }
    else if (field.type === "boolean") {
      result[field.name] = false;
    }
    else if (field.type === "multiselect") {
      result[field.name] = [];
    }
  }

  return result;
}
