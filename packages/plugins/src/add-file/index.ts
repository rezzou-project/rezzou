// Import Third-party Dependencies
import { definePlugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { addFileOperation } from "./addFile.ts";

export const addFilePlugin = definePlugin({
  id: "add-file",
  name: "Add File",
  version: "0.1.0",
  operations: [addFileOperation]
});
