// Import Third-party Dependencies
import { Gitlab } from "@gitbeaker/rest";
import type { Repo, FileContent, SubmitParams, SubmitResult } from "@rezzou/core";

// Import Internal Dependencies
import { BaseProvider } from "./base.ts";

export class GitLabAdapter extends BaseProvider {
  #client: InstanceType<typeof Gitlab>;

  constructor(token: string) {
    super();
    this.#client = new Gitlab({ token });
  }

  async listRepos(namespace: string): Promise<Repo[]> {
    const projects = await this.#client.Groups.allProjects(namespace, {
      perPage: 100,
      archived: false
    });

    return projects.map((project) => {
      return {
        id: String(project.id),
        name: project.name,
        fullPath: String(project.path_with_namespace),
        defaultBranch: String(project.default_branch ?? "main"),
        url: String(project.web_url)
      };
    });
  }

  async getFile(repoPath: string, filePath: string, branch: string): Promise<FileContent | null> {
    try {
      const file = await this.#client.RepositoryFiles.show(repoPath, filePath, branch);

      return {
        content: atob(file.content),
        ref: branch
      };
    }
    catch {
      return null;
    }
  }

  async submitChanges(params: SubmitParams): Promise<SubmitResult> {
    await this.#client.Commits.create(
      params.repoPath,
      params.headBranch,
      params.commitMessage,
      params.files.map((file) => {
        return {
          action: file.action,
          filePath: file.path,
          content: file.content
        };
      }),
      { startBranch: params.baseBranch }
    );

    const mr = await this.#client.MergeRequests.create(
      params.repoPath,
      params.headBranch,
      params.baseBranch,
      params.prTitle,
      { description: params.prDescription }
    );

    return {
      prUrl: String(mr.web_url),
      prTitle: String(mr.title)
    };
  }
}
