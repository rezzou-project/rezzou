#!/usr/bin/env node

// Import Node.js Dependencies
import { loadEnvFile } from "node:process";

// Import Internal Dependencies
import { run } from "./cli.js";

try {
  loadEnvFile();
}
catch {
  // ignore
}

await run(process.argv.slice(2));
