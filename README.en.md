# atom-crm-web

An open-source CRM web frontend for [atom-crm](https://github.com/Archetom/atom-crm), built with React, TypeScript, and Ant Design for desktop and mobile.

[简体中文](README.md) · [Quick start](#quick-start) · [Documentation](#documentation) · [Backend](https://github.com/Archetom/atom-crm)

## Features

- **Customers and sales**: customers, contacts, leads, opportunities, products, and shared pools.
- **Contracts and payments**: contracts, invoices, receivables, payment plans, and billing profiles.
- **Team collaboration**: activity records, tasks, approvals, announcements, and notifications.
- **Analytics and administration**: worklists, reports, dashboards, organization members, roles, and field settings.
- **Responsive interface**: desktop and mobile layouts, with navigation and actions driven by server authorization.

The frontend and backend build and deploy independently, sharing an OpenAPI contract. Dependency installation, unit tests, and builds can run without the backend; using the application requires a matching backend.

## Quick start

### Requirements

- Node.js 24.12.0, as specified in [`.node-version`](.node-version)
- pnpm 11.9.0, matching [`package.json`](package.json)
- MySQL and the backend running as described in the [backend README](https://github.com/Archetom/atom-crm/blob/main/README.en.md#quick-start)

### Start the frontend

```bash
git clone https://github.com/Archetom/atom-crm-web.git
cd atom-crm-web
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by the development server. API requests are proxied to `http://localhost:8080` by default; set `VITE_API_PROXY_TARGET` in `.env` to change it. The OpenAPI snapshot and generated types are included, so no contract refresh is needed on first run.

### First installation

Visit `/setup` to create the first workspace administrator, then use `/login` for subsequent sign-ins. There are no default credentials, and normal use does not require development identity headers.

These steps are for local development. See the [deployment guide](docs/deployment.md) for production containers, HTTPS, same-origin proxying, and local development identity setup.

## Development and testing

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bundle:check
```

`pnpm test:e2e:a11y` runs browser accessibility checks without a backend. Full business E2E tests require an isolated backend and seed data, and are not currently part of CI. See the [deployment and testing instructions](docs/deployment.md), and follow the [OpenAPI guide](openapi/README.md) when changing the API contract.

## Documentation

| Guide                                        | Topics                                                       |
| -------------------------------------------- | ------------------------------------------------------------ |
| [Deployment](docs/deployment.md)             | Local integration, production setup, and E2E tests           |
| [Architecture](docs/architecture.md)         | Project structure, technology choices, and data flow         |
| [OpenAPI](openapi/README.md)                 | Contract snapshots, type generation, and API synchronization |
| [API coverage](docs/api-coverage.md)         | Endpoint coverage across frontend features                   |
| [Navigation](docs/navigation.md)             | Menus, routes, and page boundaries                           |
| [Feature history](docs/functional-parity.md) | Delivered functionality and change records                   |
| [Security](docs/security.md)                 | Authentication, authorization, and sensitive data handling   |

Detailed guides are currently in Chinese.

## Contributing

Issues and pull requests are welcome. Read the [contributing guide](CONTRIBUTING.md) before getting started. Report vulnerabilities privately through the process in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
