// Import Third-party Dependencies
import { Gitlab } from "@gitbeaker/rest";
import type { NamespaceType, Namespace, Repo, FileContent, SubmitParams, SubmitResult, Member } from "@rezzou/core";

// Import Internal Dependencies
import { BaseProvider } from "./base.ts";

export class GitLabAdapter extends BaseProvider {
  readonly provider = "gitlab" as const;
  #client: InstanceType<typeof Gitlab>;

  constructor(token: string) {
    super();
    this.#client = new Gitlab({ token });
  }

  async listNamespaces(): Promise<Namespace[]> {
    const [user, groups] = await Promise.all([
      this.#client.Users.showCurrentUser(),
      this.#client.Groups.all({ minAccessLevel: 20, perPage: 100 })
    ]);

    return [
      { id: String(user.id), name: String(user.username), displayName: String(user.name), type: "user" },
      ...groups.map((group) => {
        return {
          id: String(group.id),
          name: String(group.full_path),
          displayName: String(group.name),
          type: "org" as NamespaceType
        };
      })
    ];
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

    const reviewerIds = params.reviewers && params.reviewers.length > 0
      ? await this.#resolveUserIds(params.reviewers)
      : void 0;

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

  async listMembers(namespace: string): Promise<Member[]> {
    const members = await this.#client.GroupMembers.all(namespace);

    return members.map((member) => {
      return {
        username: String(member.username),
        avatarUrl: member.avatar_url ? String(member.avatar_url) : void 0
      };
    });
  }
}
