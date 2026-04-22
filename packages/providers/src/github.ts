// Import Third-party Dependencies
import { Octokit } from "@octokit/rest";
import type { NamespaceType, Namespace, Repo, FileContent, SubmitParams, SubmitResult, Member, RepoStats } from "@rezzou/core";

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
  readonly provider = "github" as const;
  #client: InstanceType<typeof Octokit>;
  #namespaces = new Map<string, NamespaceType>();

  constructor(token: string) {
    super();
    this.#client = new Octokit({ auth: token });
  }

  async listNamespaces(): Promise<Namespace[]> {
    const [{ data: user }, { data: orgs }] = await Promise.all([
      this.#client.users.getAuthenticated(),
      this.#client.orgs.listForAuthenticatedUser({ per_page: 100 })
    ]);

    const namespaces: Namespace[] = [
      {
        id: user.login,
        name: user.login,
        displayName: user.name ?? user.login,
        type: "user",
        provider: "github",
        avatarUrl: user.avatar_url
      },
      ...orgs.map((org) => {
        return {
          id: org.login,
          name: org.login,
          displayName: org.login,
          type: "org" as NamespaceType,
          provider: "github" as const,
          avatarUrl: org.avatar_url
        };
      })
    ];

    this.#namespaces = new Map(namespaces.map((ns) => [ns.name, ns.type]));

    return namespaces;
  }

  async listRepos(namespace: string): Promise<Repo[]> {
    const namespaceType = this.#namespaces.get(namespace) ?? "org";

    const data = namespaceType === "org"
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

  async branchExists(repoPath: string, branch: string): Promise<boolean> {
    const [owner, repo] = repoPath.split("/");

    try {
      await this.#client.git.getRef({ owner, repo, ref: `heads/${branch}` });

      return true;
    }
    catch {
      return false;
    }
  }

  async submitChanges(params: SubmitParams): Promise<SubmitResult> {
    const [owner, repo] = params.repoPath.split("/");

    const { data: baseBranch } = await this.#client.repos.getBranch({
      owner,
      repo,
      branch: params.baseBranch
    });

    if (params.force) {
      try {
        await this.#client.git.updateRef({
          owner,
          repo,
          ref: `heads/${params.headBranch}`,
          sha: baseBranch.commit.sha,
          force: true
        });
      }
      catch {
        await this.#client.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${params.headBranch}`,
          sha: baseBranch.commit.sha
        });
      }
    }
    else {
      await this.#client.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${params.headBranch}`,
        sha: baseBranch.commit.sha
      });
    }

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

  async listTree(repoPath: string, branch: string): Promise<string[]> {
    const [owner, repo] = repoPath.split("/");
    const { data } = await this.#client.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: "1"
    });

    return data.tree.flatMap((item) => {
      if (item.type !== "blob") {
        return [];
      }

      return item.path;
    });
  }

  async listMembers(namespace: string): Promise<Member[]> {
    const namespaceType = this.#namespaces.get(namespace) ?? "org";

    if (namespaceType !== "org") {
      return [];
    }

    const { data } = await this.#client.orgs.listMembers({ org: namespace, per_page: 100 });

    return data.map((user) => {
      return { username: user.login, avatarUrl: user.avatar_url };
    });
  }

  async getRepoStats(repoPath: string): Promise<RepoStats> {
    const [owner, repo] = repoPath.split("/");

    const [{ data: prs }, { data: repoData }, { data: branches }] = await Promise.all([
      this.#client.pulls.list({ owner, repo, state: "open", per_page: 100 }),
      this.#client.repos.get({ owner, repo }),
      this.#client.repos.listBranches({ owner, repo, per_page: 100 })
    ]);

    return {
      openMRs: prs.length,
      openIssues: Math.max(0, repoData.open_issues_count - prs.length),
      branches: branches.length
    };
  }
}
