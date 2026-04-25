// Import Node.js Dependencies
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { historyCommand, type HistoryEntry } from "../commands/history.ts";

// CONSTANTS
const kFakeEntries: HistoryEntry[] = [
  {
    id: "1",
    timestamp: 1_745_000_000_000,
    operationId: "license-year",
    namespace: "myorg",
    results: [
      {
        repoName: "repo1",
        repoFullPath: "myorg/repo1",
        status: "done",
        prUrl: "https://github.com/myorg/repo1/pull/1"
      },
      {
        repoName: "repo2",
        repoFullPath: "myorg/repo2",
        status: "error",
        error: "branch already exists"
      }
    ]
  },
  {
    id: "2",
    timestamp: 1_744_000_000_000,
    operationId: "add-file",
    namespace: "myorg",
    results: [
      {
        repoName: "repo3",
        repoFullPath: "myorg/repo3",
        status: "done",
        prUrl: "https://github.com/myorg/repo3/pull/2"
      }
    ]
  }
];

describe("UT historyCommand", () => {
  it("should print usage with --help without reading history", async() => {
    let called = false;
    await historyCommand(["--help"], {
      readHistory: () => {
        called = true;

        return [];
      }
    });

    assert.equal(called, false);
  });

  it("should print 'No history found.' when there are no entries", async() => {
    const logs: string[] = [];
    mock.method(console, "log", (msg: string) => logs.push(msg));

    try {
      await historyCommand([], { readHistory: () => [] });
    }
    finally {
      mock.restoreAll();
    }

    assert.equal(logs.length, 1);
    assert.equal(logs[0], "No history found.");
  });

  it("should print all entries when history exists", async() => {
    const logs: string[] = [];
    mock.method(console, "log", (msg: string) => logs.push(msg));

    try {
      await historyCommand([], { readHistory: () => kFakeEntries });
    }
    finally {
      mock.restoreAll();
    }

    assert.ok(logs.some((log) => log.includes("license-year @ myorg")));
    assert.ok(logs.some((log) => log.includes("add-file @ myorg")));
  });

  it("should display done and error results correctly", async() => {
    const logs: string[] = [];
    mock.method(console, "log", (msg: string) => logs.push(msg));

    try {
      await historyCommand([], { readHistory: () => kFakeEntries });
    }
    finally {
      mock.restoreAll();
    }

    assert.ok(logs.some((log) => log.includes("[done]") && log.includes("myorg/repo1")));
    assert.ok(logs.some((log) => log.includes("[error]") && log.includes("myorg/repo2")));
  });

  it("should include PR URL in done results", async() => {
    const logs: string[] = [];
    mock.method(console, "log", (msg: string) => logs.push(msg));

    try {
      await historyCommand([], { readHistory: () => kFakeEntries });
    }
    finally {
      mock.restoreAll();
    }

    assert.ok(logs.some((log) => log.includes("https://github.com/myorg/repo1/pull/1")));
  });

  it("should respect the --limit option", async() => {
    const logs: string[] = [];
    mock.method(console, "log", (msg: string) => logs.push(msg));

    try {
      await historyCommand(["--limit", "1"], { readHistory: () => kFakeEntries });
    }
    finally {
      mock.restoreAll();
    }

    assert.ok(logs.some((log) => log.includes("license-year @ myorg")));
    const hasSecondEntry = logs.some((log) => log.includes("add-file @ myorg"));
    assert.equal(hasSecondEntry, false);
  });

  it("should output raw JSON with --json", async() => {
    const logs: string[] = [];
    mock.method(console, "log", (msg: string) => logs.push(msg));

    try {
      await historyCommand(["--json"], { readHistory: () => kFakeEntries });
    }
    finally {
      mock.restoreAll();
    }

    assert.equal(logs.length, 1);
    const parsed = JSON.parse(logs[0]) as HistoryEntry[];
    assert.equal(parsed.length, kFakeEntries.length);
    assert.equal(parsed[0].operationId, "license-year");
  });

  it("should throw on invalid --limit value", async() => {
    await assert.rejects(
      () => historyCommand(["--limit", "abc"], { readHistory: () => [] }),
      /Invalid limit/
    );
  });

  it("should throw on non-positive --limit value", async() => {
    await assert.rejects(
      () => historyCommand(["--limit", "0"], { readHistory: () => [] }),
      /Invalid limit/
    );
  });
});
