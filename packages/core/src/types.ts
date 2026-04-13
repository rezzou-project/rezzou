export type Provider = "gitlab" | "github";
export type NamespaceType = "org" | "user";

export interface Namespace {
  id: string;
  name: string;
  displayName: string;
  type: NamespaceType;
}

export interface Repo {
  id: string;
  name: string;
  fullPath: string;
  defaultBranch: string;
  url: string;
}

export interface FileContent {
  content: string;
  ref: string;
}

export interface CommitAction {
  action: "create" | "update" | "delete";
  path: string;
  content: string;
}

export interface SubmitParams {
  repoPath: string;
  /** The branch to merge into and to branch off from (e.g. "main"). */
  baseBranch: string;
  /** The new branch to create with the changes (e.g. "rezzou/license-year-2026"). */
  headBranch: string;
  commitMessage: string;
  prTitle: string;
  prDescription: string;
  reviewers?: string[];
  files: CommitAction[];
}

export interface SubmitResult {
  prUrl: string;
  prTitle: string;
}

export interface Member {
  username: string;
  avatarUrl?: string;
}

export interface ProviderAdapter {
  listNamespaces(): Promise<Namespace[]>;
  listRepos(namespace: string): Promise<Repo[]>;
  getFile(repoPath: string, filePath: string, branch: string): Promise<FileContent | null>;
  submitChanges(params: SubmitParams): Promise<SubmitResult>;
  listMembers(namespace: string): Promise<Member[]>;
}

export interface Operation {
  readonly filePath: string;
  readonly branchName: string;
  readonly commitMessage: string;
  readonly prTitle: string;
  readonly prDescription: string;
  readonly reviewers: string[];
  apply(content: string): string | null;
}

export type OperationOverrides = Pick<Operation, "branchName" | "commitMessage" | "prTitle" | "prDescription" | "reviewers">;

export interface RepoDiff {
  repo: Repo;
  filePath: string;
  original: string;
  updated: string;
}
