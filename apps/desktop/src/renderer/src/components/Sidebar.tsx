// Import Third-party Dependencies
import { useState, useEffect } from "react";
import type { Provider, Namespace } from "@rezzou/core";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import { NamespaceAvatar } from "./NamespaceAvatar.js";

type OAuthState =
  | { status: "idle"; }
  | { status: "github-device"; user_code: string; verification_uri: string; }
  | { status: "gitlab-pending"; }
  | { status: "error"; message: string; };

const kProviderLabel: Record<Provider, string> = {
  github: "GitHub",
  gitlab: "GitLab"
};

interface ProviderSectionProps {
  provider: Provider;
  namespaces: Namespace[];
  selectedNamespace: Namespace | null;
  repoCounts: Record<string, number>;
  isLoading: boolean;
  onSelectNamespace: (namespace: Namespace) => void;
}

function ProviderSection({
  provider,
  namespaces,
  selectedNamespace,
  repoCounts,
  isLoading,
  onSelectNamespace
}: ProviderSectionProps) {
  return (
    <div>
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">
        {kProviderLabel[provider]}
      </p>
      {namespaces.map((namespace) => {
        const isSelected = selectedNamespace?.id === namespace.id && selectedNamespace?.provider === provider;
        const repoCount = repoCounts[namespace.id];

        return (
          <button
            key={namespace.id}
            type="button"
            onClick={() => onSelectNamespace(namespace)}
            disabled={isLoading}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed ${
              isSelected
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            <NamespaceAvatar namespace={namespace} size={24} />
            <span className="flex-1 truncate text-left">{namespace.displayName}</span>
            {repoCount !== undefined && (
              <span className="text-xs text-gray-600">{repoCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface ConnectButtonProps {
  provider: Provider;
  oauthState: OAuthState;
  onConnect: (provider: Provider) => void;
  onCancel: () => void;
  onCopyCode: (code: string) => void;
}

function ConnectButton({ provider, oauthState, onConnect, onCancel, onCopyCode }: ConnectButtonProps) {
  if (oauthState.status === "github-device" && provider === "github") {
    return (
      <div className="mx-3 mb-2 rounded border border-gray-700 bg-gray-900 p-2 text-xs">
        <p className="mb-1 text-gray-400">
          Enter code at{" "}
          <a
            href={oauthState.verification_uri}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 underline"
          >
            github.com/login/device
          </a>
        </p>
        <div className="mb-1 flex items-center gap-2">
          <span className="font-mono font-bold tracking-widest text-white">{oauthState.user_code}</span>
          <button
            type="button"
            onClick={() => onCopyCode(oauthState.user_code)}
            className="rounded border border-gray-700 px-1.5 py-0.5 text-gray-400 hover:text-gray-200"
          >
            Copy
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 underline hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (oauthState.status === "gitlab-pending" && provider === "gitlab") {
    return (
      <div className="mx-3 mb-2 rounded border border-gray-700 bg-gray-900 p-2 text-xs text-gray-400">
        <p className="mb-1">Complete authentication in your browser...</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 underline hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onConnect(provider)}
      className="mx-3 mb-2 text-left text-xs text-gray-500 underline hover:text-gray-300"
    >
      Connect with {kProviderLabel[provider]}
    </button>
  );
}

export function Sidebar() {
  const connectedProviders = useAppStore((state) => state.connectedProviders);
  const selectedNamespace = useAppStore((state) => state.selectedNamespace);
  const repoCounts = useAppStore((state) => state.repoCounts);
  const isLoading = useAppStore((state) => state.isLoading);
  const step = useAppStore((state) => state.step);
  const goHome = useAppStore((state) => state.goHome);
  const goToPlugins = useAppStore((state) => state.goToPlugins);
  const loadRepos = useAppStore((state) => state.loadRepos);
  const receiveOAuthResult = useAppStore((state) => state.receiveOAuthResult);
  const [oauthState, setOAuthState] = useState<OAuthState>({ status: "idle" });

  useEffect(() => {
    const unsubAuth = window.api.onOAuthAuthenticated((namespaces, provider) => {
      setOAuthState({ status: "idle" });
      receiveOAuthResult(namespaces, provider);
    });

    const unsubError = window.api.onOAuthError((message) => {
      setOAuthState({ status: "error", message });
    });

    return () => {
      unsubAuth();
      unsubError();
    };
  }, [receiveOAuthResult]);

  async function handleConnect(provider: Provider) {
    setOAuthState({ status: "idle" });
    try {
      if (provider === "github") {
        const { user_code, verification_uri } = await window.api.startGitHubOAuth();
        setOAuthState({ status: "github-device", user_code, verification_uri });
      }
      else {
        await window.api.startGitLabOAuth();
        setOAuthState({ status: "gitlab-pending" });
      }
    }
    catch (oauthError) {
      const message = oauthError instanceof Error ? oauthError.message : `Failed to connect to ${provider}`;
      setOAuthState({ status: "error", message });
    }
  }

  async function handleCancel() {
    await window.api.cancelOAuth();
    setOAuthState({ status: "idle" });
  }

  const githubNamespaces = connectedProviders.github;
  const gitlabNamespaces = connectedProviders.gitlab;

  // GitHub first if connected; if only GitLab is connected, GitLab goes first
  const providerOrder: Provider[] = githubNamespaces !== undefined
    ? ["github", "gitlab"]
    : ["gitlab", "github"];

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 px-4 py-4">
        <button type="button" onClick={goHome} className="w-full text-left">
          <h1 className="text-base font-semibold tracking-tight transition-colors hover:text-gray-300">
            Rezzou
          </h1>
          <p className="text-xs text-gray-500">Bulk repository maintenance</p>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {providerOrder.map((provider) => {
          const namespaces = connectedProviders[provider];
          if (namespaces !== undefined) {
            return (
              <div key={provider} className="mb-2">
                <ProviderSection
                  provider={provider}
                  namespaces={namespaces}
                  selectedNamespace={selectedNamespace}
                  repoCounts={repoCounts}
                  isLoading={isLoading}
                  onSelectNamespace={(namespace) => void loadRepos(namespace)}
                />
              </div>
            );
          }

          return (
            <div key={provider} className="mb-2">
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">
                {kProviderLabel[provider]}
              </p>
              <ConnectButton
                provider={provider}
                oauthState={oauthState}
                onConnect={(prov) => void handleConnect(prov)}
                onCancel={() => void handleCancel()}
                onCopyCode={(code) => navigator.clipboard.writeText(code)}
              />
              {oauthState.status === "error" && (
                <p className="mx-3 mb-2 text-xs text-red-400">{oauthState.message}</p>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-2">
        <button
          type="button"
          onClick={goToPlugins}
          className={`flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
            step === "plugins"
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          Plugins
        </button>
      </div>
    </aside>
  );
}
