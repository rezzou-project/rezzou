// Import Third-party Dependencies
import type { Namespace } from "@rezzou/core";

interface NamespaceAvatarProps {
  namespace: Namespace;
  size: number;
}

export function NamespaceAvatar({ namespace, size }: NamespaceAvatarProps) {
  if (namespace.avatarUrl) {
    return (
      <img
        src={namespace.avatarUrl}
        alt={namespace.displayName}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-medium text-gray-300"
      style={{ width: size, height: size }}
    >
      {namespace.displayName[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
