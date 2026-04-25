// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { pluginCommand, type PluginStoreOptions } from "../commands/plugin.ts";

function fakeStore(overrides: Partial<PluginStoreOptions> = {}): PluginStoreOptions {
  return {
    readPluginPaths: () => [],
    scanPluginsDir: () => [],
    addPluginPath: () => undefined,
    removePluginPath: () => undefined,
    fileExists: () => true,
    ...overrides
  };
}

describe("UT pluginCommand", () => {
  describe("add", () => {
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

  it("should show usage when no subcommand is given", async() => {
    await pluginCommand([], fakeStore());
  });

  it("should show usage with --help", async() => {
    await pluginCommand(["--help"], fakeStore());
  });
});
