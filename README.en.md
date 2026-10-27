# atom-crm-web

[简体中文](README.md)

The responsive React web application for the `atom-crm` backend. The two repositories build and deploy independently, and share a versioned OpenAPI contract. The frontend uses React Router Framework Mode, strict TypeScript, Ant Design, and TanStack Query.

Repositories: [Archetom/atom-crm-web](https://github.com/Archetom/atom-crm-web) for this frontend and [Archetom/atom-crm](https://github.com/Archetom/atom-crm) for the backend.

## Run locally

Use Node.js 24.12.0 and pnpm 11.9.0, matching `.node-version`, `package.json`, and CI. Start the matching `atom-crm` backend and MySQL following its README. The default API address is `http://localhost:8080`.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

Open the frontend address printed by the development server. Visit `/setup` to create the first workspace administrator, or `/login` for an existing installation. There are no default credentials. Normal password login does not require development identity headers.

The OpenAPI snapshot and generated types are committed, so an initial checkout does not require a running backend to install, test, or build. Refresh the snapshot only when changing the backend contract, following the [OpenAPI instructions](openapi/README.md). The running application still needs the backend.

For isolated local testing only, `VITE_ENABLE_DEV_AUTH=true pnpm dev` enables `/dev/session` against a backend that explicitly enables trusted headers in `dev` or `test`. Never enable this for production.

## Verify

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bundle:check
```

CI also checks API generation, production dependency advisories, and the backend-independent accessibility specification. Full business E2E tests require an isolated backend and seed data; they are not currently part of CI. See [deployment and E2E instructions](docs/deployment.md).

## Deploy and contribute

The multi-stage Dockerfile serves the static application through Nginx. Set `ATOM_CRM_API_UPSTREAM` to the authenticated backend and provide HTTPS at the deployment boundary. Keep credentials out of `VITE_*` variables and the browser bundle. See [deployment](docs/deployment.md) for cookie authentication, reverse proxy, and file-upload requirements.

Read the [contribution guide](CONTRIBUTING.md) before submitting changes. Use repository Issues for ordinary questions and feature requests, and the [security policy](SECURITY.md) for vulnerabilities. Most detailed product and engineering documentation is currently in Chinese.

## License

[MIT](LICENSE). `private: true` in `package.json` prevents accidental npm publication; it does not restrict the source license. Third-party dependencies retain their own licenses.
