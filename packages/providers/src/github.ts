// Import Third-party Dependencies
import { Octokit } from "@octokit/rest";
import type { NamespaceType, Repo, FileContent, SubmitParams, SubmitResult, Member } from "@rezzou/core";

// Import Internal Dependencies
import { BaseProvider } from "./base.ts";

// CONSTANTS
const kCreateCommitMutation = `
  mutation CreateCommit($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      commit { oid }
    }
  }
`;

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

    await this.#client.request("POST /graphql", {
      query: kCreateCommitMutation,
      variables: {
        input: {
          branch: {
            repositoryNameWithOwner: params.repoPath,
            branchName: params.headBranch
          },
          message: { headline: params.commitMessage },
          fileChanges: {
            additions: params.files.flatMap((file) => {
              if (file.action === "delete") {
                return [];
              }

              return [
                {
                  path: file.path,
                  contents: Buffer.from(file.content).toString("base64")
                }
              ];
            }),
            deletions: params.files.flatMap((file) => {
              if (file.action !== "delete") {
                return [];
              }

              return [
                { path: file.path }
              ];
            })
          },
          expectedHeadOid: baseBranch.commit.sha
        }
      }
    });

    const { data: pr } = await this.#client.pulls.create({
      owner,
      repo,
      head: params.headBranch,
      base: params.baseBranch,
      title: params.prTitle,
      body: params.prDescription
    });

    if (params.reviewers && params.reviewers.length > 0) {
      await this.#client.pulls.requestReviewers({
        owner,
        repo,
        pull_number: pr.number,
        reviewers: params.reviewers
      });
    }

    return {
      prUrl: pr.html_url,
      prTitle: pr.title
    };
  }

  async listMembers(namespace: string): Promise<Member[]> {
    if (this.#namespaceType !== "org") {
      return [];
    }

    const { data } = await this.#client.orgs.listMembers({ org: namespace, per_page: 100 });

    return data.map((user) => {
      return { username: user.login, avatarUrl: user.avatar_url };
    });
  }
}
