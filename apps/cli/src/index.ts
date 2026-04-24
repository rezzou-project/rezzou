#!/usr/bin/env node

// Import Internal Dependencies
import { run } from "./cli.js";

await run(process.argv.slice(2));
