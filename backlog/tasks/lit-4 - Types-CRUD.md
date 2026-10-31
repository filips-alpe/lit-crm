---
id: LIT-4
title: Types CRUD
status: To Do
assignee: []
created_date: '2026-05-17 15:10'
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

- [ ] #1 A Type model exists in prisma/schema.prisma with at least id, name, createdAt, updatedAt
- [ ] #2 /types lists all types with name and created date
- [ ] #3 /types has a form to create a new type; name is required and must be unique
- [ ] #4 Each row supports edit (rename) and delete
- [ ] #5 Delete is blocked (or cascades intentionally) when the type is referenced by other records
- [ ] #6 Server actions validate input and return field-level errors to the form
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Add Type model to prisma/schema.prisma (id, name @unique, createdAt, updatedAt) and run migrate.
2. Add src/routes/types/+page.server.ts with load (list all) and actions: create, update, delete.
3. Render src/routes/types/+page.svelte: table of types + inline create form + edit/delete per row using SvelteKit form actions.
4. Add a shared zod (or hand-rolled) validator for the Type payload and surface errors via fail(400, {...}).
5. Add an e2e spec under e2e/ covering create → edit → delete happy path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

Prepared by autoplay: the work was already delivered by commit 72a5965 ("typed records platform"); the plan above predates it. No new code needed. Mapping:

- #1 `Type` model in `prisma/schema.prisma` (id, createdAt, updatedAt + `code @unique`, status, color, layout, ...). Note: the field is `code`, not `name`.
- #2 `/types` list: `src/routes/(app)/types/+page.svelte` + `listTypes()` in `src/lib/server/repos/types.ts`.
- #3 Create at `/types/new` (separate page, not inline); code required, unique (`DuplicateCodeError` on unique violation).
- #4 Edit at `/types/[id]` (`save` action); delete = soft delete (`delete`/`restore` actions).
- #5 `permanentlyDelete` is blocked with 409 when records reference the type (`has-records`).
- #6 Superforms + zod (`src/lib/schemas/types.ts`) return field-level errors.
- E2E: `e2e/types.e2e.ts` (create with color/icon, list-kind constraint).

Verified: `vitest --project client` for schema + types route tests pass (8/8). Server tests/e2e need TEST_DATABASE_URL / DB, not run.
