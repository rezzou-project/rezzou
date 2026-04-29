# @rezzou/providers

## 0.2.0

### Minor Changes

- [#46](https://github.com/rezzou-project/rezzou/pull/46) [`108029a`](https://github.com/rezzou-project/rezzou/commit/108029a3cfd695aa74e61860270853e64d002395) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Implement `branchExists` on adapters

- [#50](https://github.com/rezzou-project/rezzou/pull/50) [`1873c60`](https://github.com/rezzou-project/rezzou/commit/1873c60ed2f9952cfff6d3eae210647ae3cee579) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Rollback orphan branch on commit or MR creation failure in submitChanges

- [#22](https://github.com/rezzou-project/rezzou/pull/22) [`ed82a87`](https://github.com/rezzou-project/rezzou/commit/ed82a876660fde9adddf4a68695bd1784e48c4e5) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add optional `avatarUrl` field to `Namespace` and populate it in `listNamespaces` for GitHub and GitLab

- [#9](https://github.com/rezzou-project/rezzou/pull/9) [`de524c7`](https://github.com/rezzou-project/rezzou/commit/de524c76875de44f2308642827235182bb4f4aa3) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Added support for namespaces

- [#7](https://github.com/rezzou-project/rezzou/pull/7) [`f5ab318`](https://github.com/rezzou-project/rezzou/commit/f5ab31827c05840957ee89552a50ae2719b62430) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Use GraphQL `createCommitOnBranch` for signed GitHub commit

- [#63](https://github.com/rezzou-project/rezzou/pull/63) [`65b8983`](https://github.com/rezzou-project/rezzou/commit/65b8983b391524a738f939ee7a573a033bb95847) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add agent injection option

- [#38](https://github.com/rezzou-project/rezzou/pull/38) [`c8352cc`](https://github.com/rezzou-project/rezzou/commit/c8352ccc0f2e366a23079b0019ebec8ffe28d10f) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Implement `getRepoStats` on `GitHubAdapter` and `GitLabAdapter`

- [#4](https://github.com/rezzou-project/rezzou/pull/4) [`4689722`](https://github.com/rezzou-project/rezzou/commit/4689722b048ba019dc8a677171cfaf837a629255) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add `GitHubAdapter`

- [#8](https://github.com/rezzou-project/rezzou/pull/8) [`1d7ca6e`](https://github.com/rezzou-project/rezzou/commit/1d7ca6e7954af4302513953055f7a66689e358e1) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Added reviewers support

- [#23](https://github.com/rezzou-project/rezzou/pull/23) [`8c5e7db`](https://github.com/rezzou-project/rezzou/commit/8c5e7db384f7b8f28657c1ab132a87dc8f9ed803) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Implement `listTree` on `GitLabAdapter` & `GitHubAdapter`

- [#39](https://github.com/rezzou-project/rezzou/pull/39) [`cea6df1`](https://github.com/rezzou-project/rezzou/commit/cea6df1b1cac8498de25cbccd001bb269460b165) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Populate `provider` field on namespaces returned by `listNamespaces`

### Patch Changes

- [#19](https://github.com/rezzou-project/rezzou/pull/19) [`37d3f20`](https://github.com/rezzou-project/rezzou/commit/37d3f204b4ae710f0685b129b45ce5479624d484) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Restrict tarball to dist

- [#49](https://github.com/rezzou-project/rezzou/pull/49) [`32ee68d`](https://github.com/rezzou-project/rezzou/commit/32ee68d28d2ec566a507dfbc3ed590ac840915da) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - skip repos with nullish default_branch instead of falling back to main

- [#20](https://github.com/rezzou-project/rezzou/pull/20) [`f4c624c`](https://github.com/rezzou-project/rezzou/commit/f4c624cf763ccf816048041358abaf20b519e71b) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Added readonly provider field to `BaseProvider` and all adapters

- [#48](https://github.com/rezzou-project/rezzou/pull/48) [`f1d24cf`](https://github.com/rezzou-project/rezzou/commit/f1d24cfa95ad7c70b16e52c13ed48af007fee1f5) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Paginate listNamespaces, listRepos, and listMembers in GitHubAdapter to fetch beyond 100 items

- [#56](https://github.com/rezzou-project/rezzou/pull/56) [`78f4816`](https://github.com/rezzou-project/rezzou/commit/78f4816239099e233f44ebda14c1456d24b28e59) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - submitChanges errors are now typed RezzouError

- Updated dependencies [[`1e7e7af`](https://github.com/rezzou-project/rezzou/commit/1e7e7af45967f473cc25e5d3111f610fe4069c1c), [`4c38578`](https://github.com/rezzou-project/rezzou/commit/4c3857830589a9fe4a6c1d4d4ecf12c591682ecd), [`ed82a87`](https://github.com/rezzou-project/rezzou/commit/ed82a876660fde9adddf4a68695bd1784e48c4e5), [`de524c7`](https://github.com/rezzou-project/rezzou/commit/de524c76875de44f2308642827235182bb4f4aa3), [`37d3f20`](https://github.com/rezzou-project/rezzou/commit/37d3f204b4ae710f0685b129b45ce5479624d484), [`f4c624c`](https://github.com/rezzou-project/rezzou/commit/f4c624cf763ccf816048041358abaf20b519e71b), [`8a10419`](https://github.com/rezzou-project/rezzou/commit/8a10419effc26a921d08593b93f4dbb8f00d7bb9), [`e1cc590`](https://github.com/rezzou-project/rezzou/commit/e1cc590df1e71e442871284e4da79df857f65a4a), [`c8352cc`](https://github.com/rezzou-project/rezzou/commit/c8352ccc0f2e366a23079b0019ebec8ffe28d10f), [`2200bc9`](https://github.com/rezzou-project/rezzou/commit/2200bc99bcc29e6caba845ad9edd83aade0a6753), [`8c5e7db`](https://github.com/rezzou-project/rezzou/commit/8c5e7db384f7b8f28657c1ab132a87dc8f9ed803), [`78f4816`](https://github.com/rezzou-project/rezzou/commit/78f4816239099e233f44ebda14c1456d24b28e59), [`1d7ca6e`](https://github.com/rezzou-project/rezzou/commit/1d7ca6e7954af4302513953055f7a66689e358e1), [`cea6df1`](https://github.com/rezzou-project/rezzou/commit/cea6df1b1cac8498de25cbccd001bb269460b165), [`108029a`](https://github.com/rezzou-project/rezzou/commit/108029a3cfd695aa74e61860270853e64d002395), [`4689722`](https://github.com/rezzou-project/rezzou/commit/4689722b048ba019dc8a677171cfaf837a629255), [`b11ccfc`](https://github.com/rezzou-project/rezzou/commit/b11ccfc234e1ce38dde6b99d2b7ef63d0b212ba6)]:
  - @rezzou/core@1.0.0

## 0.1.0

### Minor Changes

- Exports `BaseProvider` and `GitLabAdapter`, the first built-in implementation of the `ProviderAdapter` interface targeting the GitLab API.

### Patch Changes

- Updated dependencies []:
  - @rezzou/core@0.1.0
