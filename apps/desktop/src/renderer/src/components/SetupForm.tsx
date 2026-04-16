// Import Third-party Dependencies
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Provider, Namespace } from "@rezzou/core";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";

// CONSTANTS
const kProviders: Provider[] = ["github", "gitlab"];
const kProviderConfig = {
  gitlab: {
    label: "Connect to GitLab",
    tokenPlaceholder: "glpat-xxxxxxxxxxxxxxxxxxxx"
  },
  github: {
    label: "Connect to GitHub",
    tokenPlaceholder: "ghp_xxxxxxxxxxxxxxxxxxxx"
  }
} as const;

type OAuthState =
  | { status: "idle"; }
  | { status: "github-device"; user_code: string; verification_uri: string; }
  | { status: "gitlab-pending"; }
  | { status: "error"; message: string; };

export function SetupForm() {
  const [provider, setProvider] = useState<Provider>("github");
  const [token, setToken] = useState("");
  const [selectedNsId, setSelectedNsId] = useState("");
  const [oauthState, setOAuthState] = useState<OAuthState>({ status: "idle" });
  const { authenticate, receiveOAuthResult, loadRepos, reset, continueWithSavedAccount, namespaces, isLoading, error } = useAppStore();
  const autoLoginUser = useAppStore((state) => state.autoLoginUser);
  const storeProvider = useAppStore((state) => state.provider);

  const isNamespacePhase = namespaces.length > 0 && autoLoginUser === null;
  const selectedNamespace = namespaces.find((ns) => ns.id === selectedNsId) ?? null;
  const providerConfig = kProviderConfig[provider];
  const isOAuthPending = oauthState.status === "github-device" || oauthState.status === "gitlab-pending";

  useEffect(() => {
    if (namespaces.length > 0) {
      if (selectedNsId === "") {
        setSelectedNsId(namespaces[0].id);
      }
      setProvider(storeProvider);
    }
  }, [namespaces, selectedNsId, storeProvider]);

  useEffect(() => {
    const unsubAuth = window.api.onOAuthAuthenticated((namespaces, oauthProvider) => {
      setOAuthState({ status: "idle" });
      receiveOAuthResult(namespaces, oauthProvider);
    });

    const unsubError = window.api.onOAuthError((message) => {
      setOAuthState({ status: "error", message });
    });

    return () => {
      unsubAuth();
      unsubError();
    };
  }, [receiveOAuthResult]);

  async function handleAuthenticate(event: FormEvent) {
    event.preventDefault();
    await authenticate(token, provider);
  }

  async function handleLoadRepos(event: FormEvent) {
    event.preventDefault();
    if (selectedNamespace !== null) {
      await loadRepos(selectedNamespace);
    }
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

  function handleProviderChange(next: Provider) {
    if (isNamespacePhase) {
      reset();
    }
    if (isOAuthPending) {
      void window.api.cancelOAuth();
    }
    setProvider(next);
    setToken("");
    setSelectedNsId("");
    setOAuthState({ status: "idle" });
  }

  function namespaceLabel(ns: Namespace): string {
    return ns.type === "user" ? `${ns.displayName} (personal)` : ns.displayName;
  }

  if (isNamespacePhase) {
    return (
      <div className="flex flex-col items-center justify-center pt-20">
        <div className="w-full max-w-md">
          <h2 className="mb-2 text-2xl font-semibold">{providerConfig.label}</h2>
          <p className="mb-6 text-sm text-gray-400">Select a namespace to browse repositories.</p>

          <form onSubmit={handleLoadRepos} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="namespace" className="text-sm font-medium text-gray-300">
                Namespace
              </label>
              <select
                id="namespace"
                value={selectedNsId}
                onChange={(event) => setSelectedNsId(event.target.value)}
                required
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                {namespaces.map((ns) => (
                  <option key={ns.id} value={ns.id}>
                    {namespaceLabel(ns)}
                  </option>
                ))}
              </select>
            </div>

            {error !== null && (
              <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading || selectedNamespace === null}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Load repositories"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const oauthError = oauthState.status === "error" ? oauthState.message : null;
  const displayedError = error ?? oauthError;

  return (
    <div className="flex flex-col items-center justify-center pt-20">
      <div className="w-full max-w-md">
        <h2 className="mb-6 text-2xl font-semibold">{providerConfig.label}</h2>

        <div className="mb-6 flex gap-1 rounded-lg border border-gray-700 p-1">
          {kProviders.map((providerOption) => (
            <button
              key={providerOption}
              type="button"
              onClick={() => handleProviderChange(providerOption)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                providerOption === provider
                  ? providerOption === "github"
                    ? "bg-gray-700 text-gray-100"
                    : "bg-orange-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {providerOption === "github" ? "GitHub" : "GitLab"}
            </button>
          ))}
        </div>

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

        {oauthState.status === "idle" && (
          <div className="mb-4 flex flex-col gap-2">
            {autoLoginUser !== null && autoLoginUser.provider === provider ? (
              <button
                type="button"
                onClick={continueWithSavedAccount}
                className="w-full rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-600"
              >
                Continue as {autoLoginUser.displayName}
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-950 px-2 text-xs text-gray-600">or use a Personal Access Token</span>
          </div>
        </div>

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
              placeholder={providerConfig.tokenPlaceholder}
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
