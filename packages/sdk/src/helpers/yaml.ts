// Import Third-party Dependencies
import * as YAML from "yaml";

export function getAtPath(content: string, path: string): unknown {
  const doc = YAML.parseDocument(content);

  return doc.getIn(path.split("."));
}

export function setAtPath(content: string, path: string, value: unknown): string {
  const doc = YAML.parseDocument(content);
  doc.setIn(path.split("."), value);

  return doc.toString();
}

export function hasPath(content: string, path: string): boolean {
  return getAtPath(content, path) !== undefined;
}

export function mergeAtPath(content: string, path: string, obj: Record<string, unknown>): string {
  const doc = YAML.parseDocument(content);
  const keys = path.split(".");

  for (const [key, value] of Object.entries(obj)) {
    doc.setIn([...keys, key], value);
  }

  return doc.toString();
}
