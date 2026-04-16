# `@rezzou/desktop`

Electron desktop application for Rezzou.

## OAuth setup

The app supports OAuth login for GitHub (Device Flow) and GitLab (PKCE). You need to create one OAuth app per provider and set the client IDs in a `.env` file at the monorepo root.

Create a `.env` file at the monorepo root:

```sh
MAIN_VITE_GITHUB_CLIENT_ID=your_github_client_id
MAIN_VITE_GITLAB_CLIENT_ID=your_gitlab_application_id
```

## Development

```sh
# from the monorepo root
npm run dev
```

## Build

```sh
# from the monorepo root
npm run build
```

## License

[MIT](../../LICENSE)
