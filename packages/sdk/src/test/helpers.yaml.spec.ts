// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { getAtPath, setAtPath, hasPath, mergeAtPath } from "../helpers/yaml.ts";

const kFixture = `
name: my-action
on:
  push:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
`.trimStart();

describe("getAtPath", () => {
  it("should get a top-level value", () => {
    assert.equal(getAtPath(kFixture, "name"), "my-action");
  });

  it("should get a nested value", () => {
    assert.equal(getAtPath(kFixture, "jobs.build.runs-on"), "ubuntu-latest");
  });

  it("should return undefined for a missing path", () => {
    assert.equal(getAtPath(kFixture, "jobs.test"), undefined);
  });
});

describe("setAtPath", () => {
  it("should set a top-level value", () => {
    const result = setAtPath(kFixture, "name", "updated");
    assert.equal(getAtPath(result, "name"), "updated");
  });

  it("should set a nested value", () => {
    const result = setAtPath(kFixture, "jobs.build.runs-on", "windows-latest");
    assert.equal(getAtPath(result, "jobs.build.runs-on"), "windows-latest");
  });

  it("should create intermediate nodes", () => {
    const result = setAtPath(kFixture, "jobs.test.runs-on", "ubuntu-latest");
    assert.equal(getAtPath(result, "jobs.test.runs-on"), "ubuntu-latest");
  });
});

describe("hasPath", () => {
  it("should return true for an existing path", () => {
    assert.equal(hasPath(kFixture, "jobs.build"), true);
  });

  it("should return false for a missing path", () => {
    assert.equal(hasPath(kFixture, "jobs.deploy"), false);
  });
});

describe("mergeAtPath", () => {
  it("should merge multiple keys at a path", () => {
    const result = mergeAtPath(kFixture, "jobs.build", { timeout: 30, "runs-on": "windows-latest" });
    assert.equal(getAtPath(result, "jobs.build.timeout"), 30);
    assert.equal(getAtPath(result, "jobs.build.runs-on"), "windows-latest");
  });
});
