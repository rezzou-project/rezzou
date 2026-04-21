// Import Third-party Dependencies
import type {
  Provider,
  ProviderAdapter,
  Repo,
  FileContent,
  SubmitParams,
  SubmitResult,
  Member,
  Namespace,
  RepoStats
} from "@rezzou/core";

export abstract class BaseProvider implements ProviderAdapter {
  abstract readonly provider: Provider;
  abstract listNamespaces(): Promise<Namespace[]>;
  abstract listRepos(namespace: string): Promise<Repo[]>;
  abstract getFile(repoPath: string, filePath: string, branch: string): Promise<FileContent | null>;
  abstract listTree(repoPath: string, branch: string): Promise<string[]>;
  abstract submitChanges(params: SubmitParams): Promise<SubmitResult>;
  abstract listMembers(namespace: string): Promise<Member[]>;
  abstract getRepoStats(repoPath: string): Promise<RepoStats>;
}
