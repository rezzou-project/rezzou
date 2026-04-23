// Import Third-party Dependencies
import { useState, useEffect } from "react";
import type { FormEvent } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import type { ProviderInfo } from "../../../shared/ipc-channels.js";

// CONSTANTS
const kBuiltinProviders = new Set(["github", "gitlab"]);
const kBuiltinConfig: Record<string, { label: string; tokenPlaceholder: string; }> = {
  gitlab: {
    label: "Connect to GitLab",
    tokenPlaceholder: "glpat-xxxxxxxxxxxxxxxxxxxx"
  },
  github: {
    label: "Connect to GitHub",
    tokenPlaceholder: "ghp_xxxxxxxxxxxxxxxxxxxx"
  }
};

type OAuthState =
  | { status: "idle"; }
  | { status: "github-device"; user_code: string; verification_uri: string; }
  | { status: "gitlab-pending"; }
  | { status: "error"; message: string; };

export function SetupForm() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<string>("github");
  const [token, setToken] = useState("");
  const [oauthState, setOAuthState] = useState<OAuthState>({ status: "idle" });
  const { authenticate, receiveOAuthResult, isLoading, error } = useAppStore();

  useEffect(() => {
    window.api.listProviders().then(setProviders).catch(() => {
      setProviders([{ provider: "github", name: "GitHub" }, { provider: "gitlab", name: "GitLab" }]);
    });

    const unsubProviders = window.api.onProvidersChanged(setProviders);
    const unsubAuth = window.api.onOAuthAuthenticated((namespaces, oauthProvider) => {
      setOAuthState({ status: "idle" });
      receiveOAuthResult(namespaces, oauthProvider);
    });
    const unsubError = window.api.onOAuthError((message) => {
      setOAuthState({ status: "error", message });
    });

    return () => {
      unsubProviders();
      unsubAuth();
      unsubError();
    };
  }, [receiveOAuthResult]);

  const builtinConfig = kBuiltinConfig[provider] ?? null;
  const isBuiltin = kBuiltinProviders.has(provider);
  const isOAuthPending = oauthState.status === "github-device" || oauthState.status === "gitlab-pending";

  const displayLabel = builtinConfig?.label ?? `Connect to ${providers.find((p) => p.provider === provider)?.name ?? provider}`;
  const tokenPlaceholder = builtinConfig?.tokenPlaceholder ?? "your-access-token";

  async function handleAuthenticate(event: FormEvent) {
    event.preventDefault();
    await authenticate(token, provider);
  }

  async function handleGitHubOAuth() {
    setOAuthState({ status: "idle" });
    try {
      const { user_code, verification_uri } = await window.api.startGitHubOAuth();
      setOAuthState({ status: "github-device", user_code, verification_uri });
    }
    catch (oauthError) {
      const message = oauthError instanceof Error ? oauthError.message : "Failed to start GitHub OAuth";
      setOAuthState({ status: "error", message });
    }
  }

  async function handleGitLabOAuth() {
    setOAuthState({ status: "idle" });
    try {
      await window.api.startGitLabOAuth();
      setOAuthState({ status: "gitlab-pending" });
    }
    catch (oauthError) {
      const message = oauthError instanceof Error ? oauthError.message : "Failed to start GitLab OAuth";
      setOAuthState({ status: "error", message });
    }
  }

  async function handleCancelOAuth() {
    await window.api.cancelOAuth();
    setOAuthState({ status: "idle" });
  }

  function handleProviderChange(next: string) {
    if (isOAuthPending) {
      void window.api.cancelOAuth();
    }
    setProvider(next);
    setToken("");
    setOAuthState({ status: "idle" });
  }

  const oauthError = oauthState.status === "error" ? oauthState.message : null;
  const displayedError = error ?? oauthError;

  return (
    <div className="flex flex-col items-center justify-center pt-20">
      <div className="w-full max-w-md">
        <h2 className="mb-6 text-2xl font-semibold">{displayLabel}</h2>

        {providers.length > 0 && (
          <div className="mb-6 flex gap-1 rounded-lg border border-gray-700 p-1">
            {providers.map((p) => (
              <button
                key={p.provider}
                type="button"
                onClick={() => handleProviderChange(p.provider)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  p.provider === provider
                    ? p.provider === "github"
                      ? "bg-gray-700 text-gray-100"
                      : p.provider === "gitlab"
                        ? "bg-orange-700 text-white"
                        : "bg-blue-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {oauthState.status === "github-device" && (
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
            <p className="text-sm text-gray-300">
              Enter the following code at{" "}
              <a
                href={oauthState.verification_uri}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 underline"
              >
                github.com/login/device
              </a>
            </p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold tracking-widest text-white">
                {oauthState.user_code}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(oauthState.user_code)}
                className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-500">Waiting for authorization...</p>
            <button
              type="button"
              onClick={handleCancelOAuth}
              className="mt-1 text-xs text-gray-500 underline hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}

        {oauthState.status === "gitlab-pending" && (
          <div className="mb-6 flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-900 p-4">
            <p className="text-sm text-gray-300">Complete authentication in your browser.</p>
            <p className="text-xs text-gray-500">Waiting for the OAuth callback...</p>
            <button
              type="button"
              onClick={handleCancelOAuth}
              className="mt-1 text-xs text-gray-500 underline hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}

        {oauthState.status === "idle" && isBuiltin && (
          <div className="mb-4 flex flex-col gap-2">
            {provider === "github" && (
              <button
                type="button"
                onClick={handleGitHubOAuth}
                disabled={isLoading}
                className="w-full rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sign in with GitHub
              </button>
            )}
            {provider === "gitlab" && (
              <button
                type="button"
                onClick={handleGitLabOAuth}
                disabled={isLoading}
                className="w-full rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sign in with GitLab
              </button>
            )}
          </div>
        )}

        {isBuiltin && (
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-950 px-2 text-xs text-gray-600">or use a Personal Access Token</span>
            </div>
          </div>
        )}

        <form onSubmit={handleAuthenticate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="token" className="text-sm font-medium text-gray-300">
              Personal Access Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={tokenPlaceholder}
              required
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {displayedError !== null && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">{displayedError}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || token.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}
