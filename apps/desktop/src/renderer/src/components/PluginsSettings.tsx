// Import Third-party Dependencies
import { useState, useEffect } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import type { LoadedPluginInfo } from "../../../shared/ipc-channels.ts";

export function PluginsSettings() {
  const goHome = useAppStore((state) => state.goHome);
  const [plugins, setPlugins] = useState<LoadedPluginInfo[]>([]);
  const [missingPlugins, setMissingPlugins] = useState<string[]>([]);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [refInput, setRefInput] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    void window.api.listPlugins().then(setPlugins);
    void window.api.getMissingPlugins().then(setMissingPlugins);

    const unsubscribe = window.api.onPluginsChanged(setPlugins);

    return unsubscribe;
  }, []);

  async function handleReload(filePath: string) {
    setLoadingPath(filePath);
    setError(null);
    try {
      await window.api.reloadPlugin(filePath);
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    finally {
      setLoadingPath(null);
    }
  }

  async function handleUnload(filePath: string) {
    setError(null);
    try {
      await window.api.unloadPlugin(filePath);
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleLoadPlugin() {
    setError(null);
    try {
      await window.api.pickAndLoadPlugin();
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCloseModal() {
    setShowUrlModal(false);
    setUrlInput("");
    setRefInput("");
    setInstallError(null);
  }

  async function handleInstallFromGit() {
    setInstalling(true);
    setInstallError(null);
    try {
      await window.api.addPluginFromGit(urlInput.trim(), refInput.trim() || undefined);
      handleCloseModal();
    }
    catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    }
    finally {
      setInstalling(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plugins</h2>
          <p className="text-sm text-gray-400">Manage loaded plugins</p>
        </div>
        <button
          type="button"
          onClick={goHome}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
        >
          ← Back
        </button>
      </div>

      {error !== null && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {missingPlugins.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-700 bg-yellow-950 px-4 py-3">
          <p className="mb-1 text-xs font-medium text-yellow-400">Not found at startup:</p>
          {missingPlugins.map((filePath) => (
            <p key={filePath} className="truncate text-xs text-yellow-600">{filePath}</p>
          ))}
        </div>
      )}

      {plugins.length === 0 ? (
        <p className="text-sm text-gray-500">No plugins loaded.</p>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <div
              key={plugin.filePath}
              className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{plugin.name}</span>
                  <span className="text-xs text-gray-500">v{plugin.version}</span>
                  {plugin.source === "auto-scanned" && (
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">auto</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">{plugin.filePath}</p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleReload(plugin.filePath)}
                  disabled={loadingPath === plugin.filePath}
                  className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingPath === plugin.filePath ? "…" : "Reload"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleUnload(plugin.filePath)}
                  disabled={loadingPath === plugin.filePath}
                  className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => void handleLoadPlugin()}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          Load a plugin…
        </button>
        <button
          type="button"
          onClick={() => setShowUrlModal(true)}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          Install from URL…
        </button>
      </div>

      {showUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6">
            <h3 className="mb-4 text-base font-semibold">Install plugin from URL</h3>

            {installError !== null && (
              <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-400">
                {installError}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-gray-400" htmlFor="plugin-url">
                Git URL
              </label>
              <input
                id="plugin-url"
                type="text"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://github.com/user/plugin"
                disabled={installing}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm text-gray-400" htmlFor="plugin-ref">
                Ref <span className="text-gray-500">(optional)</span>
              </label>
              <input
                id="plugin-ref"
                type="text"
                value={refInput}
                onChange={(event) => setRefInput(event.target.value)}
                placeholder="v1.0.0, main, abc1234…"
                disabled={installing}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {installing && (
              <p className="mb-4 text-sm text-gray-400">Cloning plugin…</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={installing}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleInstallFromGit()}
                disabled={installing || !urlInput.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {installing ? "Installing…" : "Install"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
