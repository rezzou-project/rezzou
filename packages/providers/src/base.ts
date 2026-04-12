// Import Third-party Dependencies
import type { ProviderAdapter, Repo, FileContent, SubmitParams, SubmitResult } from "@rezzou/core";

export abstract class BaseProvider implements ProviderAdapter {
  abstract listRepos(namespace: string): Promise<Repo[]>;
  abstract getFile(repoPath: string, filePath: string, branch: string): Promise<FileContent | null>;
  abstract submitChanges(params: SubmitParams): Promise<SubmitResult>;
}
