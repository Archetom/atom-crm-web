# atom-crm-web contributor guide

## Required checks

Run the smallest relevant checks before handing off, then run the baseline suite when dependencies are available:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

After any API contract refresh also run `pnpm api:generate`, `pnpm api:coverage`, and `pnpm api:check`.

## Engineering rules

- TypeScript is strict. Do not add `any`, hand-maintained DTO copies, or untyped request wrappers.
- The committed OpenAPI snapshot is the source of API types. Regenerate rather than editing `src/api/generated`.
- Organize business logic by `src/features/<feature>` and expose only intentional public boundaries. Reach another feature through its `index.ts`, never an internal path; ESLint warns on the remaining deep imports, which are tracked debt and must not grow.
- `src/api` is the lowest layer and must not import a feature. `src/api/client/api-client.ts` is the one grandfathered exception and is being unwound feature by feature.
- Runtime decode guards (`recordOf`, `positiveInteger`, `nonBlankString`, `optionalString`, `nullableString`, `isoDateTime`) live in `src/shared/utils/decode.ts`, and route parameters go through `src/shared/utils/route-params.ts`. Do not re-declare them in a feature.
- Ant Design v6 deprecations are lint-enforced: use `Alert title`, `Spin description`, `Space orientation`, `Modal`/`Drawer destroyOnHidden`.
- Design tokens live in `src/app/providers/theme.ts` and are shared by the authenticated shell and the public pages. Add a token there rather than a call-site `ConfigProvider` override or a hard-coded colour.
- UI copy: a trigger and a dialog title use `新建X`; the confirming button uses `创建X`. Use one noun for one object across the whole flow, and reserve `移除` for detaching a relation as opposed to `删除` for destroying a record.
- Server data belongs in TanStack Query; URL-recoverable state belongs in search parameters; do not copy entities into a global store. (No such store is installed today — keep it that way.)
- Ant Design `Form` is the default for new forms; it already backs the great majority of them. `react-hook-form` + `zod` stays only where it is already used (`customers`, `contacts`, `leads`) — do not extend it to a new feature without agreeing to migrate the rest.
- Never derive tenant, actor, authority, role, field access, or data scope from user input or local state.
- Development identity may only be enabled by `VITE_ENABLE_DEV_AUTH=true` in Vite development mode. Keep its numeric IDs in `sessionStorage`; never put them in an `.env` file, production bundle, or persisted application store.
- Fetch `/api/v1/authorization/me` and `/api/v1/navigation` before rendering an authenticated application route. Render menu entries only from the returned navigation tree, then apply authority checks as a defense-in-depth UI guard.
- Production bundles must not send development identity headers. Never log tokens, passwords, API keys, connector credentials, sensitive field values, or raw failed requests.
- HTTP 409 is not automatically retried. Distinguish `VERSION_CONFLICT`, `CONCURRENT_OPERATION`, and `RESOURCE_ALREADY_EXISTS` by `errCode`.
- Do not render server `errMsg` directly. Add a reviewed Chinese `errCode` mapping instead.
- File uploads use the server-defined multi-stage process; protected downloads use controlled fetch + blob until a production download-auth design exists.

## Documentation

Update `docs/api-coverage.md`, `docs/navigation.md`, `docs/ui-reference.md`, `docs/security.md`, and `docs/deployment.md` whenever a change affects their subject. Feature-local notes live in `src/features/<feature>/README.md`; keep them with the code they describe.

`docs/functional-parity.md`, `docs/navigation.md` and `docs/security.md` are append-only logs. When an entry stops being true, correct the statement rather than appending a contradiction — `README.md` and the code are the source of truth for current state. Do not restate a count (menu leaves, endpoints) in prose when a table or `app/routes.ts` already carries it.

Do not make backend changes from this repository; record cross-repository requirements explicitly.
