export function parse(content: string): unknown {
  try {
    return JSON.parse(content);
  }
  catch {
    return null;
  }
}

export function setAtPath(obj: unknown, path: string, value: unknown): unknown {
  const keys = path.split(".");
  const root = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;

  let current = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === null || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;

  return root;
}

export function setDependencyVersion(content: string, dep: string, version: string): string {
  const pkg = JSON.parse(content) as Record<string, unknown>;

  for (const field of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const section = pkg[field];
    if (section !== null && typeof section === "object" && dep in (section as object)) {
      (section as Record<string, string>)[dep] = version;

      return JSON.stringify(pkg, null, 2) + "\n";
    }
  }

  return content;
}

export function mergeDependencies(content: string, deps: Record<string, string>): string {
  const pkg = JSON.parse(content) as Record<string, unknown>;

  for (const [dep, version] of Object.entries(deps)) {
    let placed = false;
    for (const field of ["dependencies", "devDependencies", "peerDependencies"] as const) {
      const section = pkg[field];
      if (section !== null && typeof section === "object" && dep in (section as object)) {
        (section as Record<string, string>)[dep] = version;
        placed = true;
        break;
      }
    }
    if (!placed) {
      if (pkg.dependencies === null || typeof pkg.dependencies !== "object") {
        pkg.dependencies = {};
      }
      (pkg.dependencies as Record<string, string>)[dep] = version;
    }
  }

  return JSON.stringify(pkg, null, 2) + "\n";
}
