// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import type { Repo, Provider, RepoContext, ProviderAdapter } from "./types.ts";

export class ApiRepoContext implements RepoContext {
  readonly repo: Repo;
  readonly provider: Provider;

  #adapter: ProviderAdapter;
  #fileCache: Map<string, string | null> = new Map();
  #treeCache: string[] | undefined;

  constructor(adapter: ProviderAdapter, repo: Repo) {
    this.#adapter = adapter;
    this.repo = repo;
    this.provider = adapter.provider;
  }

  async readFile(filePath: string): Promise<string | null> {
    if (this.#fileCache.has(filePath)) {
      return this.#fileCache.get(filePath)!;
    }

    const result = await this.#adapter.getFile(this.repo.fullPath, filePath, this.repo.defaultBranch);
    const content = result?.content ?? null;
    this.#fileCache.set(filePath, content);

    return content;
  }

  async listFiles(glob: string): Promise<string[]> {
    const tree = await this.#getTree();

    return tree.filter((file) => path.matchesGlob(file, glob));
  }

  async exists(filePath: string): Promise<boolean> {
    if (this.#treeCache !== undefined) {
      return this.#treeCache.includes(filePath);
    }

    return await this.readFile(filePath) !== null;
  }

  async #getTree(): Promise<string[]> {
    if (this.#treeCache === undefined) {
      this.#treeCache = await this.#adapter.listTree(this.repo.fullPath, this.repo.defaultBranch);
    }

    return this.#treeCache;
  }
}
