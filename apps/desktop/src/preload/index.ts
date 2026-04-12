// Import Third-party Dependencies
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("versions", {
  electron: process.versions.electron,
  node: process.versions.node
});
