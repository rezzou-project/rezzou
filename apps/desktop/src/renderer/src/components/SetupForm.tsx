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
    description: "Enter your Personal Access Token to get started.",
    tokenPlaceholder: "glpat-xxxxxxxxxxxxxxxxxxxx"
  },
  github: {
    label: "Connect to GitHub",
    description: "Enter your Personal Access Token to get started.",
    tokenPlaceholder: "ghp_xxxxxxxxxxxxxxxxxxxx"
  }
} as const;

export function SetupForm() {
  const [provider, setProvider] = useState<Provider>("github");
  const [token, setToken] = useState("");
  const [selectedNsId, setSelectedNsId] = useState("");
  const { authenticate, loadRepos, reset, namespaces, isLoading, error } = useAppStore();

  const isNamespacePhase = namespaces.length > 0;
  const selectedNamespace = namespaces.find((ns) => ns.id === selectedNsId) ?? null;
  const providerConfig = kProviderConfig[provider];

  useEffect(() => {
    if (namespaces.length > 0 && selectedNsId === "") {
      setSelectedNsId(namespaces[0].id);
    }
  }, [namespaces, selectedNsId]);

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

  function handleProviderChange(next: Provider) {
    if (isNamespacePhase) {
      reset();
    }
    setProvider(next);
    setToken("");
    setSelectedNsId("");
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

  return (
    <div className="flex flex-col items-center justify-center pt-20">
      <div className="w-full max-w-md">
        <h2 className="mb-2 text-2xl font-semibold">{providerConfig.label}</h2>
        <p className="mb-6 text-sm text-gray-400">{providerConfig.description}</p>

        <div className="mb-6 flex gap-1 rounded-lg border border-gray-700 p-1">
          {kProviders.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderChange(p)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                p === provider
                  ? p === "github"
                    ? "bg-gray-700 text-gray-100"
                    : "bg-orange-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {p === "github" ? "GitHub" : "GitLab"}
            </button>
          ))}
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

          {error !== null && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
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
