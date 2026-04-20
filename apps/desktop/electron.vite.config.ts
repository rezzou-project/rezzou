// Import Third-party Dependencies
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    envDir: "../../",
    build: {
      externalizeDeps: true,
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
    build: {
      externalizeDeps: true,
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
