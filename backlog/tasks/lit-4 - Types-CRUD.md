---
id: LIT-4
title: Types CRUD
status: Done
assignee: []
created_date: '2026-05-17 15:10'
updated_date: '2026-11-03 04:09'
labels:
  - feature
dependencies:
  - LIT-1
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Build CRUD (list, create, edit, delete) for a 'Type' entity — a lookup/category record used to classify other CRM records. Includes Prisma model, server actions, and a /types admin screen.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 A Type model exists in prisma/schema.prisma with at least id, name, createdAt, updatedAt
- [x] #2 /types lists all types with name and created date
- [x] #3 /types has a form to create a new type; name is required and must be unique
- [x] #4 Each row supports edit (rename) and delete
- [x] #5 Delete is blocked (or cascades intentionally) when the type is referenced by other records
- [x] #6 Server actions validate input and return field-level errors to the form
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

**Superseded.** This plan predates commit 72a5965, which built Types differently: `code` instead of `name`, create and edit on separate pages instead of an inline form, and superforms errors instead of a bare `fail(400, {...})`. Only step 5 was still open, and it is now delivered. See the notes below.

1. Add Type model to prisma/schema.prisma (id, name @unique, createdAt, updatedAt) and run migrate.
2. Add src/routes/types/+page.server.ts with load (list all) and actions: create, update, delete.
3. Render src/routes/types/+page.svelte: table of types + inline create form + edit/delete per row using SvelteKit form actions.
4. Add a shared zod (or hand-rolled) validator for the Type payload and surface errors via fail(400, {...}).
5. Add an e2e spec under e2e/ covering create → edit → delete happy path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Commit 72a5965 ("typed records platform") delivered most of this. This branch adds what was missing: the created date, row-level delete, the create → edit → delete e2e and a localized `code` error.

**Acceptance criteria**

- #1 Met, with a deviation: the `Type` model in `prisma/schema.prisma` has id, createdAt, updatedAt and `code @unique`. The AC's `name` is `code` throughout.
- #2 Met on this branch: `/types` cards show `code` and "Created <date>" (`src/routes/(app)/types/+page.svelte`, `listTypes()`). The list is cards, not a table.
- #3 Met, with a deviation: create is at `/types/new`, reached by a link from `/types`, not an inline form. `code` is required and unique (`DuplicateCodeError` → `setError(form, 'code', …)`).
- #4 Met on this branch: rename by following the row link to `/types/[id]`, so edit is on a separate page rather than in the row. Active rows now have their own delete button (`delete` action on `/types`) with a confirm dialog.
- #5 Met for permanent delete only, by design: see below.
- #6 Met: superforms + zod (`typeSchema`) return field-level errors. The required-`code` error is now localized. The `max(40)` error still uses zod's default English text, as do the other limits in `typeSchema`.

**Delete behaviour (intentional)**

- Soft delete (row button, or `TypeDeleteZone` on `/types/[id]`) succeeds even when records reference the type. It only sets the status to `INACTIVE`, records stay linked, and it can be undone with restore.
- Permanent delete is only offered on a soft-deleted type, on `/types/[id]`. It returns 409 (`has-records`) while any record references the type, including one added mid-delete.
- Deleted rows have no row button: restore and permanent delete stay on `/types/[id]`.

**Verification**

Run against a throwaway local Postgres 2026-10-31 (UTC, UTF-8, since removed):

- `vitest --project server`: 154/154, which exercises uniqueness (#3) and the 409 block (#5) at runtime.
- `vitest --project client --project unit`: 744/744.
- `playwright test`: all specs pass on a seeded DB, including the new `a type can be created, renamed and deleted` in `e2e/types.e2e.ts`.
- `bun run check`: 0 errors. eslint and prettier are clean on the changed code.
- `/types` checked by screenshot at 1100px wide only.

**Known issue, not fixed here**

With the throwaway Postgres in this machine's local timezone, pre-1880 timestamps came back as Invalid Date: seeded rows showed "Created" with a blank date, and 3 `dashboard.test.ts` tests failed, including on base commit 985e789. All of it went away with the DB in UTC. The likely cause is local-mean-time offsets with seconds, not confirmed by inspecting the driver. Other non-UTC databases could be affected too.

Seeded types also have historical `createdAt` values (e.g. "Created Jan 1, 1655"), because the seed dates a type from its first use.

<!-- SECTION:NOTES:END -->
