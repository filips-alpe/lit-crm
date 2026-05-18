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
