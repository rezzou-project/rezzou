// Import Third-party Dependencies
import { useState } from "react";
import type { FormEvent } from "react";
import type { Provider, NamespaceType } from "@rezzou/core";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";

// CONSTANTS
const kProviders: Provider[] = ["gitlab", "github"];
const kGitHubNamespaceTypes: NamespaceType[] = ["org", "user"];
const kProviderConfig = {
  gitlab: {
    label: "Connect to GitLab",
    description: "Enter your Personal Access Token and the group path to get started.",
    tokenPlaceholder: "glpat-xxxxxxxxxxxxxxxxxxxx"
  },
  github: {
    label: "Connect to GitHub",
    description: "Enter your Personal Access Token and the organization or username to get started.",
    tokenPlaceholder: "ghp_xxxxxxxxxxxxxxxxxxxx"
  }
} as const;
const kNamespaceConfig = {
  gitlab: {
    org: { label: "Group path", placeholder: "my-org/my-group" }
  },
  github: {
    org: { label: "Organization", placeholder: "my-org" },
    user: { label: "Username", placeholder: "my-username" }
  }
} as const;

export function SetupForm() {
  const [provider, setProvider] = useState<Provider>("gitlab");
  const [namespaceType, setNamespaceType] = useState<NamespaceType>("org");
  const [token, setToken] = useState("");
  const [namespace, setNamespace] = useState("");
  const { connect, isLoading, error } = useAppStore();

  const providerConfig = kProviderConfig[provider];
  const namespaceConfig = provider === "github"
    ? kNamespaceConfig.github[namespaceType]
    : kNamespaceConfig.gitlab.org;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await connect(token, namespace, { provider, namespaceType });
  }

  function handleProviderChange(next: Provider) {
    setProvider(next);
    setNamespaceType("org");
    setToken("");
    setNamespace("");
  }

  return (
    <div className="flex flex-col items-center justify-center pt-20">
      <div className="w-full max-w-md">
        <h2 className="mb-2 text-2xl font-semibold">{providerConfig.label}</h2>
        <p className="mb-6 text-sm text-gray-400">{providerConfig.description}</p>

        <div className="mb-6 flex rounded-lg border border-gray-700 p-1">
          {kProviders.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => handleProviderChange(provider)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                provider === provider
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {provider === "github" ? "GitHub" : "GitLab"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="namespace" className="text-sm font-medium text-gray-300">
                {namespaceConfig.label}
              </label>
              {provider === "github" && (
                <div className="flex rounded-md border border-gray-700 p-0.5">
                  {(kGitHubNamespaceTypes).map((namespaceType) => (
                    <button
                      key={namespaceType}
                      type="button"
                      onClick={() => setNamespaceType(namespaceType)}
                      className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                        namespaceType === namespaceType
                          ? "bg-gray-700 text-gray-100"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {namespaceType === "org" ? "Org" : "User"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              id="namespace"
              type="text"
              value={namespace}
              onChange={(event) => setNamespace(event.target.value)}
              placeholder={namespaceConfig.placeholder}
              required
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error !== null && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || token.length === 0 || namespace.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}
