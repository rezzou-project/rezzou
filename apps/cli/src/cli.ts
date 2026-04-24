// Import Node.js Dependencies
import { parseArgs } from "node:util";
import { createRequire } from "node:module";

// CONSTANTS
const kRequire = createRequire(import.meta.url);
const kVersion = kRequire("../package.json").version;
const kUsage = `Usage: rezzou <command> [options]

Commands:

Options:
  -h, --help     Show this help message
  -v, --version  Show version number`;

type CommandHandler = (args: string[]) => Promise<void>;

const kCommands = new Map<string, CommandHandler>();

export async function run(args: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" }
    },
    allowPositionals: true,
    strict: false
  });

  if (values.version) {
    console.log(kVersion);

    return;
  }

  const [command, ...rest] = positionals;

  if (!command || values.help) {
    console.log(kUsage);

    return;
  }

  const handler = kCommands.get(command);

  if (!handler) {
    console.error(`Unknown command: ${command}\n`);
    console.log(kUsage);
    process.exit(1);
  }

  await handler(rest);
}
