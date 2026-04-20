// Import Third-party Dependencies
import { definePlugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { editorConfigOperation } from "./editorConfig.ts";

export const editorConfigPlugin = definePlugin({
  id: "editor-config",
  name: "EditorConfig",
  version: "0.1.0",
  operations: [editorConfigOperation]
});
