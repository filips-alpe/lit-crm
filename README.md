# lit-crm

A CRM built around typed records. A type defines a record's fields and how it is displayed, so one shared record table can hold letters, diary entries, accounts or anything else.

The demo data is Benjamin Franklin's world: 25,827 records from Founders Online and Wikidata, with 17 of the people around him as users. It also includes 217 documents and 414 linked entities from volumes I–II of Lipscomb & Bergh's _Writings of Thomas Jefferson_ (see [`prisma/seed/sources/jefferson/README.md`](prisma/seed/sources/jefferson/README.md)).

Built with SvelteKit 2, Svelte 5, TypeScript, Prisma 7 with PostgreSQL, Tailwind and daisyUI, and paraglide (English and Latvian). It deploys to Vercel.

## Getting started

Requires [bun](https://bun.sh) and Docker.

```sh
bun install
cp .env.example .env       # set AUTH_SECRET
docker compose up -d       # starts Postgres on host port 5433
bunx prisma migrate dev    # applies migrations and generates the client
bunx prisma db seed        # loads the demo data
bun run dev
```

Log in by picking a user on the login screen.

> `bunx prisma db seed` deletes all users, projects, types and records in the database that `DATABASE_URL` points at before loading the demo data.

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
bun run ext install <path|git-url> [--force]
bun run ext uninstall <id>
```

Extensions run as code in the app, so only install ones you trust.

The `franklin` extension provides the renderers for the demo types and a dashboard for each demo user.

## Demo data

The types are defined in `prisma/seed/data/types.yaml`, and the generator assigns each record a type from its source data:

| Type          | Records | Source          | Contents                                 |
| ------------- | ------- | --------------- | ---------------------------------------- |
| `letter`      | 22,258  | Founders Online | Letters and dispatches                   |
| `life`        | 910     | Wikidata        | Births, deaths, marriages, with places   |
| `diary`       | 806     | Founders Online | Diary and journal entries                |
| `essay`       | 423     | Founders Online | Essays, verse, almanacs                  |
| `note`        | 300     | Founders Online | Memoranda, notes, extracts               |
| `instrument`  | 265     | Founders Online | Treaties, contracts, certificates, deeds |
| `office`      | 244     | Wikidata        | Offices and positions held               |
| `proceedings` | 218     | Founders Online | Minutes, reports, resolutions, speeches  |
| `account`     | 162     | Founders Online | Accounts, bills, receipts, lists         |
| `membership`  | 123     | Wikidata        | Society memberships and awards           |
| `petition`    | 71      | Founders Online | Petitions, memorials, proposals          |
| `document`    | 47      | Founders Online | Other documents                          |

Founders Online types are assigned from document titles, so some documents outside `letter` land in a neighbouring type. Wikidata people are matched by name, so a few obscure names may be the wrong person. Only a small share of records have full text, and most of it is uncorrected OCR from Smyth's 1905-07 edition (see `prisma/seed/sources/smyth/REPORT.md`).

Seed data is generated from snapshots committed under `prisma/seed/sources/`. Generation uses no network and gives the same output every time:

```sh
bunx tsx prisma/seed/generate.ts                  # regenerate seed data from the snapshots
bunx tsx prisma/seed/sources/extract-fo.ts <path> # rebuild the Founders Online snapshot from the raw metadata dump
bunx tsx prisma/seed/sources/wikidata/fetch.ts    # refetch the Wikidata snapshot (network)
bunx tsx prisma/seed/sources/jefferson/fetch.ts   # cache the Jefferson OCR once (network)
bunx tsx prisma/seed/sources/jefferson/build.ts   # rebuild the Jefferson dataset from that cache
```

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
- **e2e tests** (`bun run test:e2e`) need a local Postgres — `docker compose up -d postgres` is enough. See [End-to-end tests](#end-to-end-tests).

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
