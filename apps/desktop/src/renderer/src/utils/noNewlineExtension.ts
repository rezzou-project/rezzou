// CONSTANTS
const kNewlineCheckExtensions = new Set([
  ".js", ".mjs", ".cjs", ".jsx",
  ".ts", ".mts", ".cts", ".tsx",
  ".json"
]);

export function shouldCheckNewline(filePath: string): boolean {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) {
    return false;
  }

  return kNewlineCheckExtensions.has(filePath.slice(dot).toLowerCase());
}

export function isMissingNewline(value: string): boolean {
  return value.length > 0 && !value.endsWith("\n");
}
