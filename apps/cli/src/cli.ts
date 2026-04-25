// Import Node.js Dependencies
import { parseArgs } from "node:util";
import { createRequire } from "node:module";

// Import Internal Dependencies
import { loginCommand } from "./commands/login.ts";
import { namespacesCommand } from "./commands/namespaces.ts";
import { pluginCommand } from "./commands/plugin.ts";
import { reposCommand } from "./commands/repos.ts";
import { scanCommand } from "./commands/scan.ts";

// CONSTANTS
const kRequire = createRequire(import.meta.url);
const kVersion = kRequire("../package.json").version;
const kUsage = `Usage: rezzou <command> [options]

Commands:
  login <provider>                        Authenticate with a provider (github | gitlab)
  namespaces <provider>                   List namespaces for a provider
  repos <provider> <namespace>            List repositories in a namespace
  plugin <subcommand>                     Manage plugins (add | list | remove)
  scan <provider> <namespace> --operation <id>  Scan repos with an operation (dry-run)

Options:
  -h, --help     Show this help message
  -v, --version  Show version number`;

type CommandHandler = (args: string[]) => Promise<void>;

const kCommands = new Map<string, CommandHandler>([
  ["login", loginCommand],
  ["namespaces", namespacesCommand],
  ["plugin", pluginCommand],
  ["repos", reposCommand],
  ["scan", scanCommand]
]);

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

  try {
    await handler(rest);
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
