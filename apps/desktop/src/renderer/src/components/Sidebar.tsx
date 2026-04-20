// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import { NamespaceAvatar } from "./NamespaceAvatar.js";

export function Sidebar() {
  const namespaces = useAppStore((state) => state.namespaces);
  const selectedNamespace = useAppStore((state) => state.selectedNamespace);
  const repoCounts = useAppStore((state) => state.repoCounts);
  const isLoading = useAppStore((state) => state.isLoading);
  const step = useAppStore((state) => state.step);
  const goHome = useAppStore((state) => state.goHome);
  const goToPlugins = useAppStore((state) => state.goToPlugins);
  const loadRepos = useAppStore((state) => state.loadRepos);

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
        {namespaces.map((namespace) => {
          const isSelected = selectedNamespace?.id === namespace.id;
          const repoCount = repoCounts[namespace.id];

          return (
            <button
              key={namespace.id}
              type="button"
              onClick={() => void loadRepos(namespace)}
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
