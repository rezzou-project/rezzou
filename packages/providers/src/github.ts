// Import Third-party Dependencies
import { Octokit } from "@octokit/rest";
import type { NamespaceType, Repo, FileContent, SubmitParams, SubmitResult } from "@rezzou/core";

// Import Internal Dependencies
import { BaseProvider } from "./base.ts";

export class GitHubAdapter extends BaseProvider {
  #client: InstanceType<typeof Octokit>;
  #namespaceType: NamespaceType;

  constructor(token: string, namespaceType: NamespaceType) {
    super();
    this.#client = new Octokit({ auth: token });
    this.#namespaceType = namespaceType;
  }

  async listRepos(namespace: string): Promise<Repo[]> {
    const data = this.#namespaceType === "org"
      ? (await this.#client.repos.listForOrg({ org: namespace, per_page: 100, type: "all" })).data
      : (await this.#client.repos.listForUser({ username: namespace, per_page: 100, type: "all" })).data;

    return data.flatMap((repo) => {
      if (repo.archived) {
        return [];
      }

      return {
        id: String(repo.id),
        name: repo.name,
        fullPath: repo.full_name,
        defaultBranch: String(repo.default_branch ?? "main"),
        url: repo.html_url
      };
    });
  }

  async getFile(repoPath: string, filePath: string, branch: string): Promise<FileContent | null> {
    const [owner, repo] = repoPath.split("/");

    try {
      const { data } = await this.#client.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch
      });

      if (Array.isArray(data) || data.type !== "file") {
        return null;
      }

      return {
        content: Buffer.from(data.content, "base64").toString("utf-8"),
        ref: branch
      };
    }
    catch {
      return null;
    }
  }

  async submitChanges(params: SubmitParams): Promise<SubmitResult> {
    const [owner, repo] = params.repoPath.split("/");

    const { data: baseBranch } = await this.#client.repos.getBranch({
      owner,
      repo,
      branch: params.baseBranch
    });

    await this.#client.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${params.headBranch}`,
      sha: baseBranch.commit.sha
    });

    for (const file of params.files) {
      let sha: string | undefined;

      if (file.action !== "create") {
        try {
          const { data: existing } = await this.#client.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: params.headBranch
          });

          if (!Array.isArray(existing) && existing.type === "file") {
            sha = existing.sha;
          }
        }
        catch {
          // file does not exist yet
        }
      }

      await this.#client.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: params.commitMessage,
        content: Buffer.from(file.content).toString("base64"),
        branch: params.headBranch,
        sha
      });
    }

    const { data: pr } = await this.#client.pulls.create({
      owner,
      repo,
      head: params.headBranch,
      base: params.baseBranch,
      title: params.prTitle,
      body: params.prDescription
    });

    return {
      prUrl: pr.html_url,
      prTitle: pr.title
    };
  }
}
