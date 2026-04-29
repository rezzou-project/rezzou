# @rezzou/core

## 1.0.0

### Major Changes

- [#20](https://github.com/rezzou-project/rezzou/pull/20) [`f4c624c`](https://github.com/rezzou-project/rezzou/commit/f4c624cf763ccf816048041358abaf20b519e71b) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Redesign `Operation` as a generic with `Inputs`
  Add `Patch`, `RepoContext`,`InputField` types
  Update `RepoDiff` to multi-file patches

### Minor Changes

- [#55](https://github.com/rezzou-project/rezzou/pull/55) [`1e7e7af`](https://github.com/rezzou-project/rezzou/commit/1e7e7af45967f473cc25e5d3111f610fe4069c1c) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add support for async operations

- [#52](https://github.com/rezzou-project/rezzou/pull/52) [`4c38578`](https://github.com/rezzou-project/rezzou/commit/4c3857830589a9fe4a6c1d4d4ecf12c591682ecd) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add `file-content` input field type with `relatedPathField` for language detection. Update `add-file` plugin to use it.

- [#22](https://github.com/rezzou-project/rezzou/pull/22) [`ed82a87`](https://github.com/rezzou-project/rezzou/commit/ed82a876660fde9adddf4a68695bd1784e48c4e5) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add optional `avatarUrl` field to `Namespace` and populate it in `listNamespaces` for GitHub and GitLab

- [#9](https://github.com/rezzou-project/rezzou/pull/9) [`de524c7`](https://github.com/rezzou-project/rezzou/commit/de524c76875de44f2308642827235182bb4f4aa3) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Added support for namespaces

- [#15](https://github.com/rezzou-project/rezzou/pull/15) [`8a10419`](https://github.com/rezzou-project/rezzou/commit/8a10419effc26a921d08593b93f4dbb8f00d7bb9) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add name and description fields to the Operation interface

- [#6](https://github.com/rezzou-project/rezzou/pull/6) [`e1cc590`](https://github.com/rezzou-project/rezzou/commit/e1cc590df1e71e442871284e4da79df857f65a4a) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Added `OperationOverrides` type

- [#38](https://github.com/rezzou-project/rezzou/pull/38) [`c8352cc`](https://github.com/rezzou-project/rezzou/commit/c8352ccc0f2e366a23079b0019ebec8ffe28d10f) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add `RepoStats` interface and `getRepoStats` method to `ProviderAdapter`

- [#58](https://github.com/rezzou-project/rezzou/pull/58) [`2200bc9`](https://github.com/rezzou-project/rezzou/commit/2200bc99bcc29e6caba845ad9edd83aade0a6753) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add ProviderDescriptor

- [#23](https://github.com/rezzou-project/rezzou/pull/23) [`8c5e7db`](https://github.com/rezzou-project/rezzou/commit/8c5e7db384f7b8f28657c1ab132a87dc8f9ed803) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add `ApiRepoContext` and `listTree` method to `ProviderAdapter`

- [#56](https://github.com/rezzou-project/rezzou/pull/56) [`78f4816`](https://github.com/rezzou-project/rezzou/commit/78f4816239099e233f44ebda14c1456d24b28e59) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add RezzouError class and RezzouErrorCode type

- [#8](https://github.com/rezzou-project/rezzou/pull/8) [`1d7ca6e`](https://github.com/rezzou-project/rezzou/commit/1d7ca6e7954af4302513953055f7a66689e358e1) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Added reviewers support

- [#39](https://github.com/rezzou-project/rezzou/pull/39) [`cea6df1`](https://github.com/rezzou-project/rezzou/commit/cea6df1b1cac8498de25cbccd001bb269460b165) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - `Namespace` now includes a `provider` field

- [#46](https://github.com/rezzou-project/rezzou/pull/46) [`108029a`](https://github.com/rezzou-project/rezzou/commit/108029a3cfd695aa74e61860270853e64d002395) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add `branchExists` to `ProviderAdapter` interface and `force` option to `SubmitParams`

- [#4](https://github.com/rezzou-project/rezzou/pull/4) [`4689722`](https://github.com/rezzou-project/rezzou/commit/4689722b048ba019dc8a677171cfaf837a629255) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add `Provider` & `NamespaceType` types

- [#25](https://github.com/rezzou-project/rezzou/pull/25) [`b11ccfc`](https://github.com/rezzou-project/rezzou/commit/b11ccfc234e1ce38dde6b99d2b7ef63d0b212ba6) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Add `repoFilter` type

### Patch Changes

- [#19](https://github.com/rezzou-project/rezzou/pull/19) [`37d3f20`](https://github.com/rezzou-project/rezzou/commit/37d3f204b4ae710f0685b129b45ce5479624d484) Thanks [@PierreDemailly](https://github.com/PierreDemailly)! - Restrict tarball to dist

## 0.1.0

### Minor Changes

- Provides shared types (`Repo`, `Operation`, `RepoDiff`, `ProviderAdapter`, etc.) and two engine functions: `scanRepos` to collect diffs across repositories and `applyRepoDiff` to submit changes via a provider adapter.
