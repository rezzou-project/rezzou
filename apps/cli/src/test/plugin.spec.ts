// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { pluginCommand, type PluginStoreOptions } from "../commands/plugin.ts";
import type { GitPluginEntry, ParsedGitUrl } from "../git-plugin-store.ts";

function fakeStore(overrides: Partial<PluginStoreOptions> = {}): PluginStoreOptions {
  return {
    readPluginPaths: () => [],
    scanPluginsDir: () => [],
    addPluginPath: () => undefined,
    removePluginPath: () => undefined,
    fileExists: () => true,
    isGitUrl: () => false,
    parseGitUrl: () => null,
    gitPluginPath: (slug) => `/fake/plugins-git/${slug}`,
    dirExists: () => false,
    gitClone: async() => undefined,
    resolveCommitHash: async() => "abc1234deadbeef",
    resolveEntry: () => "/fake/entry.ts",
    addGitPluginEntry: () => undefined,
    readGitPlugins: () => [],
    fetchGitPlugin: async() => undefined,
    confirm: async() => true,
    ...overrides
  };
}

describe("UT pluginCommand", () => {
  describe("add (file path)", () => {
    it("should call addPluginPath with the resolved path", async() => {
      let addedPath: string | undefined;
      const store = fakeStore({
        fileExists: () => true,
        addPluginPath: (filePath) => {
          addedPath = filePath;
        }
      });

      await pluginCommand(["add", "/some/plugin.ts"], store);

      assert.equal(addedPath, "/some/plugin.ts");
    });

    it("should not call addPluginPath when the file does not exist", async() => {
      let called = false;
      const store = fakeStore({
        fileExists: () => false,
        addPluginPath: () => {
          called = true;
        }
      });

      await pluginCommand(["add", "/missing/plugin.ts"], store);

      assert.equal(called, false);
    });

    it("should not call addPluginPath when path argument is missing", async() => {
      let called = false;
      const store = fakeStore({
        addPluginPath: () => {
          called = true;
        }
      });

      await pluginCommand(["add"], store);

      assert.equal(called, false);
    });
  });

  describe("add (git url)", () => {
    const kFakeParsed: ParsedGitUrl = {
      cloneUrl: "https://github.com/example/plugin",
      ref: null,
      slug: "github.com-example-plugin"
    };

    it("should clone and register the plugin", async() => {
      let clonedUrl: string | undefined;
      let clonedRef: string | null | undefined;
      let addedEntry: GitPluginEntry | undefined;
      let addedPath: string | undefined;

      const store = fakeStore({
        isGitUrl: () => true,
        parseGitUrl: () => kFakeParsed,
        dirExists: () => false,
        gitClone: async(cloneUrl, _targetPath, { ref }) => {
          clonedUrl = cloneUrl;
          clonedRef = ref;
        },
        resolveCommitHash: async() => "deadbeef1234",
        resolveEntry: () => "/fake/plugins-git/github.com-example-plugin/index.ts",
        addGitPluginEntry: (entry) => {
          addedEntry = entry;
        },
        addPluginPath: (filePath) => {
          addedPath = filePath;
        }
      });

      await pluginCommand(["add", "https://github.com/example/plugin"], store);

      assert.equal(clonedUrl, "https://github.com/example/plugin");
      assert.equal(clonedRef, null);
      assert.equal(addedEntry?.slug, "github.com-example-plugin");
      assert.equal(addedEntry?.url, "https://github.com/example/plugin");
      assert.equal(addedEntry?.pinnedCommit, "deadbeef1234");
      assert.equal(addedPath, "/fake/plugins-git/github.com-example-plugin/index.ts");
    });

    it("should pass ref to gitClone when URL contains a ref", async() => {
      let clonedRef: string | null | undefined;

      const store = fakeStore({
        isGitUrl: () => true,
        parseGitUrl: () => {
          return { ...kFakeParsed, ref: "v1.0.0" };
        },
        dirExists: () => false,
        gitClone: async(_cloneUrl, _targetPath, { ref }) => {
          clonedRef = ref;
        }
      });

      await pluginCommand(["add", "https://github.com/example/plugin#v1.0.0"], store);

      assert.equal(clonedRef, "v1.0.0");
    });

    it("should show an error and skip clone when the directory already exists", async() => {
      let cloneCalled = false;

      const store = fakeStore({
        isGitUrl: () => true,
        parseGitUrl: () => kFakeParsed,
        dirExists: () => true,
        gitClone: async() => {
          cloneCalled = true;
        }
      });

      await pluginCommand(["add", "https://github.com/example/plugin"], store);

      assert.equal(cloneCalled, false);
    });

    it("should not register the plugin when clone fails", async() => {
      let addedPath: string | undefined;

      const store = fakeStore({
        isGitUrl: () => true,
        parseGitUrl: () => kFakeParsed,
        dirExists: () => false,
        gitClone: async() => {
          throw new Error("connection refused");
        },
        addPluginPath: (filePath) => {
          addedPath = filePath;
        }
      });

      await pluginCommand(["add", "https://github.com/example/plugin"], store);

      assert.equal(addedPath, undefined);
    });

    it("should not register the plugin when entry point cannot be resolved", async() => {
      let addedPath: string | undefined;

      const store = fakeStore({
        isGitUrl: () => true,
        parseGitUrl: () => kFakeParsed,
        dirExists: () => false,
        gitClone: async() => undefined,
        resolveEntry: () => null,
        addPluginPath: (filePath) => {
          addedPath = filePath;
        }
      });

      await pluginCommand(["add", "https://github.com/example/plugin"], store);

      assert.equal(addedPath, undefined);
    });

    it("should show an error when the git URL cannot be parsed", async() => {
      let cloneCalled = false;

      const store = fakeStore({
        isGitUrl: () => true,
        parseGitUrl: () => null,
        gitClone: async() => {
          cloneCalled = true;
        }
      });

      await pluginCommand(["add", "git+https://"], store);

      assert.equal(cloneCalled, false);
    });
  });

  describe("list", () => {
    it("should call readPluginPaths and scanPluginsDir", async() => {
      let readCalled = false;
      let scanCalled = false;
      const store = fakeStore({
        readPluginPaths: () => {
          readCalled = true;

          return [];
        },
        scanPluginsDir: () => {
          scanCalled = true;

          return [];
        }
      });

      await pluginCommand(["list"], store);

      assert.ok(readCalled);
      assert.ok(scanCalled);
    });
  });

  describe("remove", () => {
    it("should call removePluginPath with the resolved path", async() => {
      let removedPath: string | undefined;
      const store = fakeStore({
        removePluginPath: (filePath) => {
          removedPath = filePath;
        }
      });

      await pluginCommand(["remove", "/some/plugin.ts"], store);

      assert.equal(removedPath, "/some/plugin.ts");
    });

    it("should not call removePluginPath when path argument is missing", async() => {
      let called = false;
      const store = fakeStore({
        removePluginPath: () => {
          called = true;
        }
      });

      await pluginCommand(["remove"], store);

      assert.equal(called, false);
    });
  });

  describe("update", () => {
    const kFakeEntry: GitPluginEntry = {
      slug: "github.com-example-plugin",
      url: "https://github.com/example/plugin",
      ref: "v1.0.0",
      pinnedCommit: "aaaaaaaabbbbbbbb",
      installedAt: "2024-01-01T00:00:00.000Z"
    };

    it("should update the plugin and write new pinnedCommit when hash changes and user confirms", async() => {
      let updatedEntry: GitPluginEntry | undefined;

      const store = fakeStore({
        readGitPlugins: () => [kFakeEntry],
        dirExists: () => true,
        fetchGitPlugin: async() => undefined,
        resolveCommitHash: async() => "ccccccccdddddddd",
        confirm: async() => true,
        addGitPluginEntry: (entry) => {
          updatedEntry = entry;
        }
      });

      await pluginCommand(["update", "github.com-example-plugin"], store);

      assert.equal(updatedEntry?.pinnedCommit, "ccccccccdddddddd");
      assert.equal(updatedEntry?.slug, kFakeEntry.slug);
    });

    it("should not update when user declines confirmation", async() => {
      let addCalled = false;

      const store = fakeStore({
        readGitPlugins: () => [kFakeEntry],
        dirExists: () => true,
        fetchGitPlugin: async() => undefined,
        resolveCommitHash: async() => "ccccccccdddddddd",
        confirm: async() => false,
        addGitPluginEntry: () => {
          addCalled = true;
        }
      });

      await pluginCommand(["update", "github.com-example-plugin"], store);

      assert.equal(addCalled, false);
    });

    it("should report up to date when hash is unchanged", async() => {
      let addCalled = false;

      const store = fakeStore({
        readGitPlugins: () => [kFakeEntry],
        dirExists: () => true,
        fetchGitPlugin: async() => undefined,
        resolveCommitHash: async() => kFakeEntry.pinnedCommit,
        addGitPluginEntry: () => {
          addCalled = true;
        }
      });

      await pluginCommand(["update", "github.com-example-plugin"], store);

      assert.equal(addCalled, false);
    });

    it("should show error when plugin id is not found in git plugins", async() => {
      let fetchCalled = false;

      const store = fakeStore({
        readGitPlugins: () => [],
        fetchGitPlugin: async() => {
          fetchCalled = true;
        }
      });

      await pluginCommand(["update", "unknown-plugin"], store);

      assert.equal(fetchCalled, false);
    });

    it("should show error when plugin directory does not exist", async() => {
      let fetchCalled = false;

      const store = fakeStore({
        readGitPlugins: () => [kFakeEntry],
        dirExists: () => false,
        fetchGitPlugin: async() => {
          fetchCalled = true;
        }
      });

      await pluginCommand(["update", "github.com-example-plugin"], store);

      assert.equal(fetchCalled, false);
    });

    it("should show error when fetch fails", async() => {
      let addCalled = false;

      const store = fakeStore({
        readGitPlugins: () => [kFakeEntry],
        dirExists: () => true,
        fetchGitPlugin: async() => {
          throw new Error("failed to fetch git repository");
        },
        addGitPluginEntry: () => {
          addCalled = true;
        }
      });

      await pluginCommand(["update", "github.com-example-plugin"], store);

      assert.equal(addCalled, false);
    });

    it("should show usage when id argument is missing", async() => {
      let fetchCalled = false;

      const store = fakeStore({
        fetchGitPlugin: async() => {
          fetchCalled = true;
        }
      });

      await pluginCommand(["update"], store);

      assert.equal(fetchCalled, false);
    });
  });

  it("should show usage when no subcommand is given", async() => {
    await pluginCommand([], fakeStore());
  });

  it("should show usage with --help", async() => {
    await pluginCommand(["--help"], fakeStore());
  });
});
