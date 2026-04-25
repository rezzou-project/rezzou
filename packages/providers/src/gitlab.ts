// Import Node.js Dependencies
import type { Agent } from "node:http";

// Import Third-party Dependencies
import { Gitlab } from "@gitbeaker/rest";
import type { NamespaceType, Namespace, Repo, FileContent, SubmitParams, SubmitResult, Member, RepoStats } from "@rezzou/core";

// Import Internal Dependencies
import { BaseProvider } from "./base.ts";
import { mapProviderError } from "./errors.ts";

interface GitLabAdapterOptions {
  agent?: Agent;
}

export class GitLabAdapter extends BaseProvider {
  readonly provider = "gitlab";
  #client: InstanceType<typeof Gitlab>;

  constructor(token: string, options: GitLabAdapterOptions = {}) {
    super();
    this.#client = new Gitlab({
      token,
      ...options
    });
  }

  async listNamespaces(): Promise<Namespace[]> {
    const [user, groups] = await Promise.all([
      this.#client.Users.showCurrentUser(),
      this.#client.Groups.all({ minAccessLevel: 20, perPage: 100 })
    ]);

    return [
      {
        id: String(user.id),
        name: String(user.username),
        displayName: String(user.name),
        type: "user",
        provider: "gitlab" as const,
        avatarUrl: user.avatar_url ? String(user.avatar_url) : void 0
      },
      ...groups.map((group) => {
        return {
          id: String(group.id),
          name: String(group.full_path),
          displayName: String(group.name),
          type: "org" as NamespaceType,
          provider: "gitlab" as const,
          avatarUrl: group.avatar_url ? String(group.avatar_url) : void 0
        };
      })
    ];
  }

  async listRepos(namespace: string): Promise<Repo[]> {
    const projects = await this.#client.Groups.allProjects(namespace, {
      perPage: 100,
      archived: false
    });

    return projects.flatMap((project) => {
      if (!project.default_branch) {
        console.warn(`[rezzou] skipping repo ${project.path_with_namespace}: no default branch`);

        return [];
      }

      return {
        id: String(project.id),
        name: project.name,
        fullPath: String(project.path_with_namespace),
        defaultBranch: String(project.default_branch),
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

  async #resolveUserIds(usernames: string[]): Promise<number[]> {
    const results = await Promise.all(
      usernames.map(async(username) => {
        const users = await this.#client.Users.all({ username });
        const user = users.find((u) => String(u.username) === username);

        if (!user) {
          throw new Error(`Unknown reviewer: ${username}`);
        }

        return Number(user.id);
      })
    );

    return results;
  }

  async branchExists(repoPath: string, branch: string): Promise<boolean> {
    try {
      await this.#client.Branches.show(repoPath, branch);

      return true;
    }
    catch {
      return false;
    }
  }

  async submitChanges(params: SubmitParams): Promise<SubmitResult> {
    if (params.force && await this.branchExists(params.repoPath, params.headBranch)) {
      await this.#client.Branches.remove(params.repoPath, params.headBranch);
    }

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

    const reviewerIds = params.reviewers && params.reviewers.length > 0
      ? await this.#resolveUserIds(params.reviewers)
      : void 0;

    try {
      const mr = await this.#client.MergeRequests.create(
        params.repoPath,
        params.headBranch,
        params.baseBranch,
        params.prTitle,
        {
          description: params.prDescription,
          ...(reviewerIds !== void 0 && { reviewerIds })
        }
      );

      return {
        prUrl: String(mr.web_url),
        prTitle: String(mr.title)
      };
    }
    catch (error) {
      await this.#client.Branches.remove(params.repoPath, params.headBranch).catch(() => void 0);
      throw mapProviderError(error, `Failed to create merge request for ${params.repoPath}`);
    }
  }

  async listTree(repoPath: string, branch: string): Promise<string[]> {
    const items = await this.#client.Repositories.allRepositoryTrees(repoPath, {
      ref: branch,
      recursive: true,
      perPage: 100
    });

    return items.flatMap((item) => {
      if (item.type !== "blob") {
        return [];
      }

      return item.path;
    });
  }

  async listMembers(namespace: string): Promise<Member[]> {
    const members = await this.#client.GroupMembers.all(namespace);

    return members.map((member) => {
      return {
        username: String(member.username),
        avatarUrl: member.avatar_url ? String(member.avatar_url) : void 0
      };
    });
  }

  async getRepoStats(repoPath: string): Promise<RepoStats> {
    const [mrs, issues, branches] = await Promise.all([
      this.#client.MergeRequests.all({ projectId: repoPath, state: "opened", perPage: 100, maxPages: 1 }),
      this.#client.Issues.all({ projectId: repoPath, state: "opened", perPage: 100, maxPages: 1 }),
      this.#client.Branches.all(repoPath, { perPage: 100, maxPages: 1 })
    ]);

    return {
      openMRs: mrs.length,
      openIssues: issues.length,
      branches: branches.length
    };
  }
}
