// Import Third-party Dependencies
import { definePlugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { renameFileOperation } from "./renameFile.ts";

export const renameFilePlugin = definePlugin({
  id: "rename-file",
  name: "Rename File",
  version: "0.1.0",
  operations: [renameFileOperation]
});
