# lit-crm

A CRM built around typed records. A type defines a record's fields and how it is displayed, so one shared record table can hold letters, diary entries, accounts or anything else.

The demo data is Benjamin Franklin's world: 25,827 records from Founders Online and Wikidata, with 17 of the people around him as users. It lives in its own repository, [lit-crm-seeds](https://github.com/filips-alpe/lit-crm-seeds); see [Franklin demo data](#franklin-demo-data). This repo ships only a tiny fixture.

Built with SvelteKit 2, Svelte 5, TypeScript, Prisma 7 with PostgreSQL, Tailwind and daisyUI, and paraglide (English and Latvian). It deploys to Vercel.

## Getting started

Requires [bun](https://bun.sh) and Docker.

```sh
bun install
cp .env.example .env       # set AUTH_SECRET
docker compose up -d       # starts Postgres on host port 5433
bunx prisma migrate dev    # applies migrations and generates the client
bunx prisma db seed        # loads a small fixture (users alice and bob, one type, one project, three records)
bun run dev
```

Log in by picking a user on the login screen.

> `bunx prisma db seed` deletes all users, projects, types and records in the database that `DATABASE_URL` points at before loading the fixture.

## Franklin demo data

The full dataset, its loader and the Franklin renderers and dashboards are in [lit-crm-seeds](https://github.com/filips-alpe/lit-crm-seeds). With the schema migrated (`bunx prisma migrate deploy`):

```sh
git clone https://github.com/filips-alpe/lit-crm-seeds ../lit-crm-seeds
(cd ../lit-crm-seeds && bun install && bun run seed --db "$DATABASE_URL")   # loads the data
bun run ext install ../lit-crm-seeds --path extension                       # renderers, dashboards, messages
bun run dev
```

`bun run seed` there **deletes all users, projects, types and records** in the target database first, and refuses to run without `--db`. The extension is optional but the data's types name its renderers (`rendererId`); without it they fall back to the default view and users get the generic dashboard.

You can also install straight from git: `bun run ext install https://github.com/filips-alpe/lit-crm-seeds.git --path extension`.

The extension's own tests import app code, so they run here once it is installed (`bunx vitest run`). Two of them also read seed data and need a checkout of lit-crm-seeds: set `SEEDS_DIR` (default `../lit-crm-seeds`), otherwise they are skipped.

## How it works

- **Types** (`/types`) set a record's fields. Each field has a kind and is stored in a column of the shared record table, chosen by its `writeTo`. The field kinds are in `src/lib/fields/registry.ts`.
- **Records** (`/data`) appear in a timeline with infinite scroll, and open in a modal or on their own page.
- **Renderers** give a type its own row, card and detail view. A type selects one with `rendererId`; without one it uses the generic view. The built-in renderers are in `src/lib/renderers`.
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

`--path` names the folder inside the source that holds the extension (its `extension.json`). If the extension has `messages/<locale>.json` files, `install` merges those keys into `messages/` and `uninstall` removes them again.

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
- **e2e tests** only run when `DATABASE_URL` points at a local Postgres. `playwright.config.ts` has the setup steps. They log in as the fixture users `alice` and `bob`, so seed with `bunx prisma db seed` (not the Franklin data) first.

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
