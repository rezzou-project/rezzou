// Import Third-party Dependencies
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    envDir: "../../",
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: `${import.meta.dirname}/src/main/index.ts`,
          "plugin-ts-runner": `${import.meta.dirname}/src/main/plugin-ts-runner.ts`
        },
        output: {
          entryFileNames: "[name].js"
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].js"
        }
      }
    }
  },
  renderer: {
    plugins: [react()]
  }
});
