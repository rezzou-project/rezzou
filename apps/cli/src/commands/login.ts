// Import Node.js Dependencies
import { parseArgs } from "node:util";
import * as timers from "node:timers/promises";

// Import Internal Dependencies
import { saveToken } from "../credentials.ts";
import { isTTY, selectProvider, promptGitLabToken } from "../interactive.ts";

// CONSTANTS
const kGitHubClientId = process.env.REZZOU_GITHUB_CLIENT_ID ?? "Ov23liiCyupi2IZwtyTC";
const kGitHubDeviceCodeUrl = "https://github.com/login/device/code";
const kGitHubAccessTokenUrl = "https://github.com/login/oauth/access_token";
const kGitHubScopes = "repo read:org";
const kSlowDownIncrement = 5;
const kUsage = `Usage: rezzou login [provider]

Providers:
  github   Authenticate via GitHub device flow
  gitlab   Authenticate with a GitLab Personal Access Token (scopes: api, read_user)

Options:
  -h, --help   Show this help message`;

interface GitHubDeviceFlowStart {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

interface GitHubPollOptions {
  clientId: string;
  deviceCode: string;
  interval: number;
}

async function pollGitHubToken(options: GitHubPollOptions): Promise<string> {
  const { clientId, deviceCode } = options;
  let pollInterval = options.interval;

  while (true) {
    await timers.setTimeout(pollInterval * 1_000);

    const response = await fetch(kGitHubAccessTokenUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      })
    });

    const data = await response.json() as Record<string, string>;

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "slow_down") {
      pollInterval += kSlowDownIncrement;
    }
    else if (data.error !== "authorization_pending") {
      throw new Error(data.error_description ?? data.error ?? "Unknown OAuth error");
    }
  }
}

async function loginGitHub(): Promise<void> {
  const response = await fetch(kGitHubDeviceCodeUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: kGitHubClientId, scope: kGitHubScopes })
  });

  if (!response.ok) {
    throw new Error(`GitHub device code request failed with status ${response.status}`);
  }

  const { device_code, user_code, verification_uri, interval } = await response.json() as GitHubDeviceFlowStart;

  console.log(`Open the following URL in your browser: ${verification_uri}`);
  console.log(`Enter code: ${user_code}`);
  console.log("Waiting for authentication...");

  const token = await pollGitHubToken({ clientId: kGitHubClientId, deviceCode: device_code, interval });

  saveToken("github", token);
  console.log("GitHub authentication successful.");
}

async function loginGitLab(): Promise<void> {
  const token = await promptGitLabToken();

  if (!token) {
    throw new Error("Token cannot be empty");
  }

  saveToken("gitlab", token);
  console.log("GitLab token saved successfully.");
}

export async function loginCommand(args: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true,
    strict: false
  });

  if (values.help) {
    console.log(kUsage);

    return;
  }

  let [provider] = positionals;

  if (!provider) {
    if (!isTTY()) {
      console.log(kUsage);

      return;
    }
    provider = await selectProvider();
  }

  if (provider === "github") {
    await loginGitHub();
  }
  else if (provider === "gitlab") {
    await loginGitLab();
  }
  else {
    console.error(`Unknown provider: ${provider}\n`);
    console.log(kUsage);
    process.exit(1);
  }
}
