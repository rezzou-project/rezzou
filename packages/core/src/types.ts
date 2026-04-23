export type Provider = "gitlab" | "github";
export type NamespaceType = "org" | "user";

export interface Namespace {
  id: string;
  name: string;
  displayName: string;
  type: NamespaceType;
  provider: Provider;
  avatarUrl?: string;
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

export interface Patch {
  action: "create" | "update" | "delete";
  path: string;
  content?: string;
}

export interface RepoContext {
  readonly repo: Repo;
  readonly provider: Provider;
  readFile(path: string): Promise<string | null>;
  listFiles(glob: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

export type InputFieldType = "string" | "number" | "boolean" | "select" | "multiselect" | "file-content";

export interface InputField {
  name: string;
  label: string;
  type: InputFieldType;
  description?: string;
  required?: boolean;
  default?: unknown;
  placeholder?: string;
  options?: Array<{ value: string; label: string; }>;
  pattern?: string;
  min?: number;
  max?: number;
  /**
   * For "file-content" fields: name of the sibling field holding the file path (used for language detection).
   */
  relatedPathField?: string;
}

export interface Operation<Inputs extends Record<string, unknown> = Record<string, unknown>> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly inputs?: readonly InputField[];
  apply(ctx: RepoContext, inputs: Inputs): Promise<Patch[] | null>;
  branchName(inputs: Inputs): string;
  commitMessage(inputs: Inputs): string;
  prTitle(inputs: Inputs): string;
  prDescription(inputs: Inputs): string;
}

export interface OperationOverrides {
  branchName?: string;
  commitMessage?: string;
  prTitle?: string;
  prDescription?: string;
  reviewers?: string[];
}

export interface OperationDefaults {
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prDescription: string;
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
  /** If true, reset the head branch to the base branch before applying changes. */
  force?: boolean;
}

export interface SubmitResult {
  prUrl: string;
  prTitle: string;
}

export interface Member {
  username: string;
  avatarUrl?: string;
}

export interface RepoStats {
  openMRs: number;
  openIssues: number;
  branches: number;
}

export interface ProviderAdapter {
  readonly provider: Provider;
  listNamespaces(): Promise<Namespace[]>;
  listRepos(namespace: string): Promise<Repo[]>;
  getFile(repoPath: string, filePath: string, branch: string): Promise<FileContent | null>;
  listTree(repoPath: string, branch: string): Promise<string[]>;
  branchExists(repoPath: string, branch: string): Promise<boolean>;
  submitChanges(params: SubmitParams): Promise<SubmitResult>;
  listMembers(namespace: string): Promise<Member[]>;
  getRepoStats(repoPath: string): Promise<RepoStats>;
}

export interface RepoDiff {
  repo: Repo;
  patches: Patch[];
  originals: Record<string, string>;
}

export interface RepoFilter {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  test(ctx: RepoContext): Promise<boolean>;
}
