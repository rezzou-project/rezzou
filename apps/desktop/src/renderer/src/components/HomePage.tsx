// Import Third-party Dependencies
import { useState, useEffect } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import { NamespaceAvatar } from "./NamespaceAvatar.js";

type OAuthState =
  | { status: "idle"; }
  | { status: "github-device"; user_code: string; verification_uri: string; }
  | { status: "error"; message: string; };

export function HomePage() {
  const namespaces = useAppStore((state) => state.namespaces);
  const repoCounts = useAppStore((state) => state.repoCounts);
  const isLoading = useAppStore((state) => state.isLoading);
  const provider = useAppStore((state) => state.provider);
  const loadRepos = useAppStore((state) => state.loadRepos);
  const receiveOAuthResult = useAppStore((state) => state.receiveOAuthResult);
  const [oauthState, setOAuthState] = useState<OAuthState>({ status: "idle" });

  useEffect(() => {
    const unsubAuth = window.api.onOAuthAuthenticated((updatedNamespaces, oauthProvider) => {
      setOAuthState({ status: "idle" });
      receiveOAuthResult(updatedNamespaces, oauthProvider);
    });

    const unsubError = window.api.onOAuthError((message) => {
      setOAuthState({ status: "error", message });
    });

    return () => {
      unsubAuth();
      unsubError();
    };
  }, [receiveOAuthResult]);

  async function handleGrantAccess() {
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

  async function handleCancelOAuth() {
    await window.api.cancelOAuth();
    setOAuthState({ status: "idle" });
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">Choose a namespace</h2>
      <p className="mb-6 text-sm text-gray-400">
        Select an organization or your personal account to browse repositories.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {namespaces.map((namespace) => {
          const repoCount = repoCounts[namespace.id];

          return (
            <button
              key={namespace.id}
              type="button"
              onClick={() => void loadRepos(namespace)}
              disabled={isLoading}
              className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-gray-700 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <NamespaceAvatar namespace={namespace} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{namespace.displayName}</p>
                <p className="text-xs text-gray-500">
                  {namespace.type === "user" ? "Personal account" : "Organization"}
                  {repoCount !== undefined ? ` · ${repoCount} repos` : ""}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {provider === "github" && (
        <div className="mt-6">
          {oauthState.status === "github-device" ? (
            <div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
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
          ) : (
            <p className="text-xs text-gray-500">
              Not seeing an organization?{" "}
              <button
                type="button"
                onClick={handleGrantAccess}
                className="text-blue-400 underline hover:text-blue-300"
              >
                Grant access to more organizations
              </button>
              {oauthState.status === "error" && (
                <span className="ml-2 text-red-400">{oauthState.message}</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
