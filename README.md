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
- **e2e tests** only run when `DATABASE_URL` points at a local Postgres. `playwright.config.ts` has the setup steps. They log in as the fixture users `alice` (admin) and `bob` (not an admin), so seed with `bunx prisma db seed` (not the Franklin data) first. The seed also creates the permission fixtures (a private record, a record shared with hidden amounts through a group, one shared for writing, a hidden record) that `e2e/permissions.e2e.ts` exercises, including the admin screen.
- `AUTH_SECRET` (16+ characters) must be set for the e2e server.

## Permissions: grants on Postgres row-level security

Who may see and change what is data (groups, memberships, grants) enforced by Postgres row-level security, in the migrations `grants_tables` and `grants_rls` (the full rule list is the header comment of `grants_rls`). Two non-owner roles share one rule set: `lit_app` (the app, read and write) and `lit_gateway` (the AI-chat gateway, SELECT only, ACTIVE records and projects only). The acting user is the one named by `app.user_id` (`set_config('app.user_id', id, true)` per transaction); unset, empty, unknown or INACTIVE (admins too) means nobody and every table is empty. The table owner is not subject to the policies (no `FORCE ROW LEVEL SECURITY`), so migrations, seeds and app code that has not switched to `lit_app` behave as before.

- **Admin** (`lit_user.isAdmin`): everything, hidden records included.
- **Everyone else** never sees a `hidden` record. Without any grant they get WRITE on records they created or are assigned to, and on every record of a project they created or are assigned to.
- **Grants** go to a user or a group and have a scope (person: records whose creator or assignee is that person; project; type; record) and a level, READ or WRITE (WRITE includes read). All paths are OR-ed. A project grant covers the project's records and makes the project readable; the project row itself (edit, delete) belongs to its creator, assignee and admins.
- **Delete**: whoever may write a record may hard-delete it. A project is deleted by its creator, assignee or an admin. Links are visible when both ends are. Adding or removing a link needs WRITE on the record **and** the right to put records into the project: admin, the project's creator or assignee, or a WRITE grant on the project (a READ grant is not enough; the app refuses such a change with a 403 instead of ignoring it, and saving a record with an unchanged project list never touches the links).
- **Amounts** (`sum`, `hours`, `total`): shown when any path to the record shows them (admin, implicit, or a grant without `hideAmounts`), else NULL. The restricted roles have no column privilege on them; the door is the view `lit_record_amount`. Every new `lit_record` column needs `GRANT SELECT (col) ON lit_record TO lit_app, lit_gateway`.
- **Users and types** are readable by active users; types are admin-write only; a user edits their own profile but only an admin changes username, status or `isAdmin`. **Groups, memberships, grants**: a user reads only their own rows, only admins write. Creator and `hidden` cannot be changed by a non-admin (guard triggers). **No amount oracle**: any UPDATE that names `sum`, `hours` or `total` (`BEFORE UPDATE OF` trigger) is refused for a non-admin without amounts access to that record, whatever the value, so a writer with masked amounts cannot learn them by guessing; the app does not send amount columns for such a writer.

### How the app uses it: request context

The app runs every database operation as `lit_app` for the signed-in user, over the same `DATABASE_URL` (no new credential):

- `src/hooks.server.ts` reads the session, looks the user up _as that user_ (an unknown or inactive user is invisible, so "no user") and wraps `resolve(event)` in `runAs(userId | null, ...)` (`src/lib/server/db/context.ts`, an `AsyncLocalStorage`). Every load, action and endpoint inherits it.
- `src/lib/prisma.ts` exports `prisma`, a Prisma client extension: each operation (model or raw) runs in one transaction that first does `set_config('role', 'lit_app', true)` and `set_config('app.user_id', <user>, true)`. Both settings are transaction-local, so concurrent requests cannot leak into each other and a pooled connection comes back clean (a concurrency test interleaves five users over 300 operations). `runAs` awaits inside on purpose: Prisma promises are lazy and would otherwise run after the context is gone.
- **No context means nobody**: outside a request the scoped `prisma` sees empty tables and every write is refused. Login uses the definer functions `lit_login_users()` and `lit_resolve_user()` (no table access). Migrations, `prisma/seed.ts`, scripts and test fixtures use the owner connection, `prismaOwner` (ESLint confines importing it to tests and fixtures).
- `sum`, `hours` and `total` are never selected by Prisma (global `omit`; `lit_app` has no column privilege). `src/lib/server/db/amounts.ts` reads them, with `masked` and `canWrite`, from the view `lit_record_amount`; the dashboard and the type editor's per-column counts do the same. The UI shows a masked amount as **Hidden**, which is different from an empty one.
- The database decides, the app reflects it: a record the user cannot read is a 404, a record they can read but not write opens read-only (disabled form, no Save), an edit or delete they are not allowed to make is a 403 or a form error, never a 500. Only an admin picks or changes a record's creator (the field is read-only for everyone else); types are admin-write (the type screens are read-only for non-admins); the **Admin** screen (`/admin`: users with admin flag and status, groups and memberships, grants with a scope picker, level and hide-amounts) is admin-only, absent from the navigation for everyone else, and refuses to demote or deactivate the last active admin. Hard-deleting a record also deletes its project links (the foreign key cascades as the table owner, so links to projects the user cannot read go too). The last active admin is protected by a database trigger (`lit_guard_last_admin`, advisory lock), so two concurrent demotions cannot both succeed.
- Legacy repo tests run on the owner connection through `LIT_DB_OWNER_FALLBACK=1` (set by the vitest `server` project only; the app refuses to start with it set anywhere outside vitest, whatever `NODE_ENV` is). Tests of the RLS behaviour use `runAs`.

- The scoped `prisma` refuses interactive transactions (`$transaction(async tx => ...)`) with an error: every operation would run in its own transaction, so the callback would not be atomic. Use nested writes, the array form `$transaction([...])` or one raw statement.
- The app refuses to start with a missing, short or placeholder `AUTH_SECRET` (the value in `.env.example` included). Generate one: `openssl rand -base64 32`.

### Known limits

What this model does **not** protect against, so nobody assumes it does:

- **F3, owner DSN + `SET LOCAL ROLE`.** The app connects as the table owner and drops to `lit_app` per transaction. Any raw SQL that reaches the connection can `RESET ROLE` (back to the owner, no policies) or `set_config('app.user_id', <an admin>, true)`. The model is only as strong as "no user-controlled SQL"; today every raw query is a tagged template with bound parameters. The fix is a separate LOGIN role for the app that is a member of `lit_app` only (and has no right to `SET ROLE` to the owner); it needs a new credential and deploy change, which was deliberately not part of this rollout.
- **F4, login is username-only (pre-existing).** `lit_login_users()` lists every active username and `lit_resolve_user()` returns an id with no secret, so anyone who reaches `/login` can sign in as any user, an admin included, and every policy is moot. Fine for a demo; not for real data. Put real authentication (password, SSO) in front before that. The seed data ships an admin (`bfranklin`) for the same reason: never seed a real database.
- **F5, existence and size probes.** A restricted role can tell that a row exists from errors (a duplicate `lit_project.code` of an invisible project, foreign-key errors, `ON CONFLICT DO NOTHING`; ids are random, so they are not guessable) and read table sizes from `pg_class.reltuples` / `pg_stat_user_tables.n_live_tup`. Row contents are not exposed.
- **TEMP and the public schema.** `PUBLIC` has `TEMP` on the database, so `lit_app` and the gateway login can create temporary tables (disk use, no bypass found; `REVOKE TEMP ON DATABASE <db> FROM PUBLIC` if you can). On PostgreSQL 14 and older `PUBLIC` may also have `CREATE` on schema `public`: run `REVOKE CREATE ON SCHEMA public FROM PUBLIC`. The definer functions pin `search_path = pg_catalog, public`.
- **Pre-existing roles.** The migrations create `lit_app` and `lit_gateway` only when missing and print a WARNING when an existing one has LOGIN, BYPASSRLS or SUPERUSER; fix it as the message says.
- **Interactive transactions** on the scoped client are refused (see above).

### Rollout

Deploy the migrations and the app together, in this order:

1. Back up the database.
2. `prisma migrate deploy` with a role that has `CREATEROLE` (see "Deploying the roles"). The old app keeps working meanwhile: it is the table owner and the policies do not apply to it. The old gateway does not: it reads `lit_user` directly, which the new policies refuse, so it fails from this step until step 5. On Vercel, `vercel-build` runs this step as part of the app deploy, so steps 2 and 4 happen together.
3. If the migration printed the `GRANT lit_app TO <owner>` notice, run it once as an admin.
4. Deploy the app. From this version it is a client of `lit_app`: without step 3 every request fails closed.
5. Deploy the gateway **with** it: the gateway needs the new migration (it uses `lit_resolve_user` and the grant model) and the app and gateway must agree on the same rules.

Rollback: redeploy the previous app (it connects as the owner, unaffected by the policies). The database changes are forward-only.

### Test it: the exact oracle

`scripts/rls-oracle.ts` migrates a throwaway Postgres, loads data, adds a seeded random overlay (admins, inactive users, groups, memberships, 20-80 grants over all scopes and levels, hidden and inactive records, amounts, extra links), and for every user plus the anonymous and an unknown user compares what `lit_app` and `lit_gateway` can see, update, delete and insert (records, projects, links, users, types, groups, memberships, grants) and which amounts are masked, against an independent oracle in TypeScript that calls no policy or function. It also checks that the anonymous, inactive and gateway roles cannot write, that a non-admin cannot write admin tables, set `isAdmin`, grant itself access, change a creator or read `sum`/`hours`/`total` directly. Every overlay runs in a transaction that is rolled back. Any mismatch exits 1.

```sh
bun scripts/rls-oracle.ts                          # starts a Docker postgres on 127.0.0.1:5490-5499, generated data (25 seeds) and the Franklin seeds (3 seeds), removes the container
bun scripts/rls-oracle.ts --data generated --seeds 100
bun scripts/rls-oracle.ts --db postgresql://postgres:pw@127.0.0.1:5491/lit_rls_x   # your own throwaway server
```

Needs Docker (or `--db`), bun, and for the Franklin data a checkout of lit-crm-seeds at `../lit-crm-seeds` (`--seeds-dir`). The script only accepts loopback hosts, never port 5433, database names starting `lit_rls_`, and never the databases named in `DATABASE_URL`, `DIRECT_URL` or `TEST_DATABASE_URL`. The delete probes switch off foreign-key triggers inside a savepoint, so the server user must be a superuser (true for the Docker image).

### Deploying the roles

Create a login role for the gateway outside migrations, with your own password and a connection limit that matches the gateway's pool:

```sql
CREATE ROLE lit_gateway_login LOGIN PASSWORD '<password>' NOSUPERUSER NOBYPASSRLS CONNECTION LIMIT 8;
GRANT lit_gateway TO lit_gateway_login;
ALTER ROLE lit_gateway_login SET statement_timeout = '5s';
```

The connection limit leaves headroom over the gateway's pool of 5. The statement timeout stops one expensive question (a full amounts read costs seconds on large data) from holding a connection. `groundtruth/delivery/lit-crm-gateway/setup_role.sql` runs the same statements.

The Groundtruth gateway in `groundtruth/delivery/lit-crm-gateway` connects as that login role. Things to know when you deploy:

- **The migrating role needs `CREATEROLE`** (or be a superuser): the migration creates `lit_gateway` and `lit_app` unless they exist and runs `GRANT lit_app TO <migrating role>` so the app can `SET ROLE lit_app`. If a role already exists and the migrating role cannot grant it, the migration prints the `GRANT` an admin must run. Roles are cluster-wide, so a second database in the same cluster reuses them.
- **Anonymous reads of `lit_user` are gone.** The login picker and the gateway's identity lookup use `lit_login_users()` and `lit_resolve_user(username)`.
- **`PUBLIC` holds `TEMP` on the database by default**, so the gateway role can create temporary tables. They are private to its session and hold nothing it could not already read. As a hardening step run `REVOKE TEMP ON DATABASE <db> FROM PUBLIC;` (not in the migration, since it would also remove temp tables from every other non-owner role). Roles that relied on `PUBLIC` for `TEMP` then need an explicit `GRANT TEMP ON DATABASE <db> TO <role>`.
- **Table sizes are not hidden from the restricted roles.** `pg_stat_user_tables.n_live_tup`, `pg_class.reltuples` and `EXPLAIN` row estimates report totals whatever the policies say.

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
