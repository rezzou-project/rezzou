// Import Third-party Dependencies
import { definePlugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { removeFileOperation } from "./removeFile.ts";

export const removeFilePlugin = definePlugin({
  id: "remove-file",
  name: "Remove File",
  version: "0.1.0",
  operations: [removeFileOperation]
});
