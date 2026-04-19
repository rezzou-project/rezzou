export function appendUnique(content: string, line: string): string {
  const lines = content.split("\n");
  const hasTrailingNewline = content.endsWith("\n");
  const trimmed = hasTrailingNewline ? lines.slice(0, -1) : lines;

  if (trimmed.includes(line)) {
    return content;
  }

  return hasTrailingNewline
    ? `${trimmed.join("\n")}\n${line}\n`
    : `${content}\n${line}`;
}

export function removeMatching(content: string, pattern: RegExp | string): string {
  const lines = content.split("\n");
  const hasTrailingNewline = content.endsWith("\n");
  const trimmed = hasTrailingNewline ? lines.slice(0, -1) : lines;

  const filtered = trimmed.filter((line) => {
    if (typeof pattern === "string") {
      return !line.includes(pattern);
    }

    return !pattern.test(line);
  });

  return hasTrailingNewline ? `${filtered.join("\n")}\n` : filtered.join("\n");
}
