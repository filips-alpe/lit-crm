# lit-crm

A CRM built around typed records. A type defines a record's fields and how it is displayed, so one shared record table can hold letters, diary entries, accounts or anything else.

The demo data is Benjamin Franklin's world: 25,827 records from Founders Online and Wikidata, with 17 of the people around him as users, plus 217 documents and 413 linked entities from volumes I–II of Lipscomb & Bergh's _Writings of Thomas Jefferson_ (Jefferson dataset, with record mentions). It lives in its own repository, [lit-crm-seeds](https://github.com/filips-alpe/lit-crm-seeds); see [Franklin and Jefferson demo data](#franklin-and-jefferson-demo-data). This repo ships only a tiny fixture.

Built with SvelteKit 2, Svelte 5, TypeScript, Prisma 7 with PostgreSQL, Tailwind and daisyUI, and paraglide (English and Latvian). It deploys to Vercel.

## Getting started

Requires [bun](https://bun.sh) and Docker.

```sh
bun install
cp .env.example .env       # set AUTH_SECRET
docker compose up -d       # starts Postgres on host port 5433
bunx prisma migrate dev    # applies migrations and generates the client
bunx prisma db seed        # loads a small fixture (users alice and bob, one type, one project, three records, one mention)
bun run dev
```

Log in by picking a user on the login screen.

> `bunx prisma db seed` deletes all users, projects, types and records in the database that `DATABASE_URL` points at before loading the fixture.

## Franklin and Jefferson demo data

The full datasets (Franklin, and Jefferson with its linked entities and record mentions), their loader and the Franklin renderers and dashboards are in [lit-crm-seeds](https://github.com/filips-alpe/lit-crm-seeds). With the schema migrated (`bunx prisma migrate deploy`):

```sh
git clone https://github.com/filips-alpe/lit-crm-seeds ../lit-crm-seeds
(cd ../lit-crm-seeds && bun install && bun run seed --db "$DATABASE_URL")   # loads the data
bun run ext install ../lit-crm-seeds --path extension                       # renderers, dashboards, messages
bun run dev
```

The loader writes the Jefferson records after the Franklin ones and, when the database has the `lit_record_mention` table, the mentions that the best pages show. `bun run seed` there **deletes all users, projects, types and records** in the target database first, and refuses to run without `--db`. The extension is optional but the data's types name its renderers (`rendererId`); without it they fall back to the default view and users get the generic dashboard.

You can also install straight from git: `bun run ext install https://github.com/filips-alpe/lit-crm-seeds.git --path extension`.

The extension's own tests import app code, so they run here once it is installed (`bunx vitest run`). Two of them also read seed data and need a checkout of lit-crm-seeds: set `SEEDS_DIR` (default `../lit-crm-seeds`), otherwise they are skipped.

## How it works

- **Types** (`/types`) set a record's fields. Each field has a kind and is stored in a column of the shared record table, chosen by its `writeTo`. The field kinds are in `src/lib/fields/registry.ts`.
- **Records** (`/data`) appear in a timeline with infinite scroll, and open in a modal or on their own page.
- **Renderers** give a type its own row, card and detail view. A type selects one with `rendererId`; without one it uses the generic view. The built-in renderers are in `src/lib/renderers`.
- **Best pages** (`/page/[id]`) show any record as one page assembled from its data: fields, text with linked mentions, where it is mentioned, related entities and sources. A section with no data is left out.
- **Dashboards** (`/`) are per user and get SQL aggregates plus capped record lists. See [`src/lib/dashboards/README.md`](src/lib/dashboards/README.md).

## Extensions

An extension adds renderers and dashboards from `src/extensions/<id>/`. Anything that exports from these paths is discovered automatically:

- `renderers/index.ts` exports `renderers: RecordRenderer[]`
- `dashboards/index.ts` exports `dashboards`, keyed by username

```sh
bun run ext list
bun run ext install <path|git-url> [--path <subdir>] [--force]
bun run ext uninstall <id>
```

`--path` names the folder inside the source that holds the extension (its `extension.json`). If the extension has `messages/<locale>.json` files, `install` merges those keys into `messages/` and recompiles the paraglide messages (so `bun run check` is clean straight away); `uninstall` removes only the keys the install added and recompiles. A key the app already has with different text makes `install` fail without changing anything.

Extensions run as code in the app, so only install ones you trust.

The `franklin` extension (in lit-crm-seeds) provides the renderers for the demo types and a dashboard for each demo user.

## Testing

```sh
bun run check                 # type check
bun run lint                  # prettier and eslint
bunx vitest run --project unit
bunx vitest run --project client
bunx vitest run --project server
bunx playwright test
```

The `server` and e2e suites write to their database, so they refuse to run against your dev data:

- **Server tests** truncate tables between cases and need a `TEST_DATABASE_URL` that differs from `DATABASE_URL`. `.env.example` has the setup steps.
- **e2e tests** (`bun run test:e2e`) need a local Postgres - `docker compose up -d postgres` is enough. See [End-to-end tests](#end-to-end-tests).

### End-to-end tests

```sh
docker compose up -d postgres   # or set E2E_DATABASE_URL to any local Postgres
bun run test:e2e
```

That single command does everything:

1. `e2e/global-setup.ts` creates a template database (`lit_crm_e2e_template`), runs `prisma migrate deploy` and the seed on it, and builds the app.
2. Each Playwright worker clones the template (`CREATE DATABASE … TEMPLATE`) into `lit_crm_e2e_w<N>` and starts its own `vite preview` server on port `4180+N` bound to that clone.
3. After the run the worker databases and the template are dropped.

`E2E_DATABASE_URL` (default: the docker-compose Postgres on `:5433`) selects the server; it must be `localhost`/`127.0.0.1`, and the dev database is never used.

Specs import `test`/`expect` from `e2e/fixtures.ts` rather than `@playwright/test`. Besides the normal fixtures it provides worker-scoped `db` (a `PrismaClient` bound to the worker's database, for arranging or asserting data), `workerDbUrl` and `serverUrl`; `baseURL` already points at the worker's server. `e2e/db-isolation.e2e.ts` is a worked example.

## Read-only gateway role (row-level security)

The `rls_gateway` migration enables Postgres row-level security on `lit_record`, `lit_project` and `lit_project_record` for one NOLOGIN role, `lit_gateway`, which has `SELECT` only. The app connects as the table owner (no `FORCE ROW LEVEL SECURITY`) and is not affected. A gateway sets `SET LOCAL app.user_id` (`set_config('app.user_id', id, true)`) per transaction; unset, empty, unknown or inactive sees nothing. A user sees records they created or are assigned to, plus every record in a project they created or are assigned to; a user with `lit_user.isAdmin` sees everything. A user whose `status` is not `ACTIVE` sees nothing, even an inactive admin (`rls_inactive_users` migration). `lit_user` and `lit_type` stay readable.

Create a login role for the gateway outside migrations, with your own password and a connection limit that matches the gateway's pool:

```sql
CREATE ROLE lit_gateway_login LOGIN PASSWORD '<password>' NOSUPERUSER NOBYPASSRLS CONNECTION LIMIT 8;
GRANT lit_gateway TO lit_gateway_login;
```

The Groundtruth gateway in `groundtruth/delivery/lit-crm-gateway` connects as that login role. Things to know when you deploy it:

- **The migrating role needs `CREATEROLE`** (or be a superuser): the `rls_gateway` migration runs `CREATE ROLE lit_gateway` unless it already exists. Without `CREATEROLE`, create the role once as an admin (`CREATE ROLE lit_gateway NOLOGIN NOINHERIT;`) and run the migration afterwards; it then skips the creation. Roles are cluster-wide, so a second database in the same cluster reuses the role.
- **Policies exist only for `lit_gateway`.** The app works because it runs as the table owner. If you ever run the app as a different, non-owner role, it would see zero rows from the three protected tables (row security is on and no policy applies to that role). Keep the app on the owner role, or add policies for the new role.
- **`PUBLIC` holds `TEMP` on the database by default**, so the gateway role can create temporary tables. They are private to its session, hold nothing it could not already read, and cannot reach other roles' data, but they do use disk and the role can run `CREATE TEMP TABLE ... AS SELECT` of what it sees. As a hardening step run `REVOKE TEMP ON DATABASE <db> FROM PUBLIC;` (the migration does not, since it would also remove temp tables from every other non-owner role, for example reporting users). Consequence: roles that relied on `PUBLIC` for `TEMP` need an explicit `GRANT TEMP ON DATABASE <db> TO <role>`.
- **Table sizes are not hidden from the gateway role.** `pg_stat_user_tables.n_live_tup`, `pg_class.reltuples` and `EXPLAIN` row estimates report totals for the whole table whatever the policies say. Row-level security protects rows, not statistics.

## Translations

Message keys are `humanId()` values from `@inlang/sdk`. Add each key to every file in `messages/`, then use it as `m.<id>()`:

```sh
node -e "import('@inlang/sdk').then(m => console.log(m.humanId()))"
```

## Building

```sh
bun run build
bun run preview
```

Vercel runs `vercel-build`, which applies migrations with `prisma migrate deploy` before building.
