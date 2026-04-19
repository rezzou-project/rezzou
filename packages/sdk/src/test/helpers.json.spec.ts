// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parse, setAtPath, setDependencyVersion, mergeDependencies } from "../helpers/json.ts";

describe("parse", () => {
  it("should parse valid JSON", () => {
    assert.deepEqual(parse('{"a":1}'), { a: 1 });
  });

  it("should return null on invalid JSON", () => {
    assert.equal(parse("not json"), null);
  });
});

describe("setAtPath", () => {
  it("should set a top-level key", () => {
    assert.deepEqual(setAtPath({ a: 1 }, "b", 2), { a: 1, b: 2 });
  });

  it("should set a nested key", () => {
    assert.deepEqual(setAtPath({ a: { b: 1 } }, "a.b", 2), { a: { b: 2 } });
  });

  it("should create intermediate objects", () => {
    assert.deepEqual(setAtPath({}, "a.b.c", 42), { a: { b: { c: 42 } } });
  });

  it("should not mutate the original object", () => {
    const original = { a: 1 };
    setAtPath(original, "b", 2);
    assert.deepEqual(original, { a: 1 });
  });
});

describe("setDependencyVersion", () => {
  it("should update a dep in dependencies", () => {
    const pkg = JSON.stringify({ dependencies: { foo: "1.0.0" } }, null, 2) + "\n";
    const result = setDependencyVersion(pkg, "foo", "2.0.0");
    assert.equal(JSON.parse(result).dependencies.foo, "2.0.0");
  });

  it("should update a dep in devDependencies", () => {
    const pkg = JSON.stringify({ devDependencies: { bar: "^1.0.0" } }, null, 2) + "\n";
    const result = setDependencyVersion(pkg, "bar", "^2.0.0");
    assert.equal(JSON.parse(result).devDependencies.bar, "^2.0.0");
  });

  it("should return content unchanged if dep not found", () => {
    const pkg = JSON.stringify({ dependencies: {} }, null, 2) + "\n";
    assert.equal(setDependencyVersion(pkg, "missing", "1.0.0"), pkg);
  });
});

describe("mergeDependencies", () => {
  it("should update existing deps and add missing ones to dependencies", () => {
    const pkg = JSON.stringify({ dependencies: { foo: "1.0.0" } }, null, 2) + "\n";
    const result = mergeDependencies(pkg, { foo: "2.0.0", bar: "1.0.0" });
    const parsed = JSON.parse(result);
    assert.equal(parsed.dependencies.foo, "2.0.0");
    assert.equal(parsed.dependencies.bar, "1.0.0");
  });

  it("should prefer the section where the dep already exists", () => {
    const pkg = JSON.stringify({
      dependencies: { foo: "1.0.0" },
      devDependencies: { bar: "1.0.0" }
    }, null, 2) + "\n";
    const result = mergeDependencies(pkg, { foo: "2.0.0", bar: "2.0.0" });
    const parsed = JSON.parse(result);
    assert.equal(parsed.dependencies.foo, "2.0.0");
    assert.equal(parsed.devDependencies.bar, "2.0.0");
  });
});
