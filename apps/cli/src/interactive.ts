// Import Third-party Dependencies
import { select, multiselect, question, confirm, transformers, validators } from "@topcli/prompts";
import type { ProviderAdapter, Operation, Repo, InputField } from "@rezzou/core";

// CONSTANTS
const kProviderChoices = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" }
];

export function isTTY(): boolean {
  return process.stdin.isTTY === true;
}

export async function selectProvider(): Promise<string> {
  return select("Choose a provider:", { choices: kProviderChoices });
}

export async function selectNamespace(adapter: ProviderAdapter): Promise<string> {
  const namespaces = await adapter.listNamespaces();
  if (namespaces.length === 0) {
    throw new Error("No namespaces found for this provider.");
  }

  return select("Choose a namespace:", {
    choices: namespaces.map((ns) => {
      return {
        value: ns.id,
        label: ns.displayName,
        description: ns.type
      };
    })
  });
}

export async function selectOperation(operations: Map<string, Operation>): Promise<string> {
  if (operations.size === 0) {
    throw new Error("No operations available. Add a plugin with: rezzou plugin add <path>");
  }

  return select("Choose an operation:", {
    choices: [...operations.entries()].map(([id, op]) => {
      return {
        value: id,
        label: op.name,
        description: op.description
      };
    })
  });
}

export async function multiselectRepos(adapter: ProviderAdapter, namespace: string): Promise<Repo[]> {
  const repos = await adapter.listRepos(namespace);
  if (repos.length === 0) {
    throw new Error(`No repositories found in namespace "${namespace}".`);
  }

  const selected = await multiselect("Select repositories to scan:", {
    choices: repos.map((r) => {
      return { value: r.fullPath, label: r.fullPath };
    })
  });

  return repos.filter((r) => selected.includes(r.fullPath));
}

export async function promptGitLabToken(): Promise<string> {
  return question("Enter your GitLab Personal Access Token (scopes: api, read_user): ", {
    secure: true
  });
}

async function promptField(field: InputField): Promise<unknown> {
  const label = `${field.label}:`;

  switch (field.type) {
    case "string":
      return question(label, {
        defaultValue: field.default as string | undefined,
        validators: field.required ? [validators.required()] : []
      });

    case "number":
      return question(label, {
        defaultValue: field.default === undefined ? undefined : String(field.default),
        transformer: transformers.number()
      });

    case "boolean":
      return confirm(label, {
        initial: field.default as boolean | undefined
      });

    case "select":
      return select(label, {
        choices: (field.options ?? []).map((opt) => {
          return { value: opt.value, label: opt.label };
        })
      });

    case "multiselect":
      return multiselect(label, {
        choices: (field.options ?? []).map((opt) => {
          return { value: opt.value, label: opt.label };
        })
      });

    case "file-content":
      return question(label, {
        validators: field.required ? [validators.required()] : []
      });

    default:
      throw new Error(`Unsupported input type: "${(field as InputField).type}"`);
  }
}

export async function promptOperationInputs(
  operation: Operation,
  provided: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...provided };
  const interactive = isTTY();

  for (const field of operation.inputs ?? []) {
    if (field.name in result) {
      continue;
    }

    if (interactive) {
      result[field.name] = await promptField(field);
    }
    else if (field.default !== undefined) {
      result[field.name] = field.default;
    }
    else if (field.required) {
      throw new Error(`Missing required input: "${field.name}" (${field.label}). Use --input ${field.name}=<value>`);
    }
  }

  return result;
}
