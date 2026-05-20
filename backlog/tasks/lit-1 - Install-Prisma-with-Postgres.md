---
id: LIT-1
title: Install Prisma with Postgres
status: In Progress
assignee: []
created_date: '2026-05-17 14:35'
updated_date: '2026-05-17 15:25'
labels:
  - chore
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Set up Prisma ORM with a Postgres database for the Lit CRM app.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Prisma + @prisma/client added as dependencies
- [ ] #2 Postgres datasource configured in prisma/schema.prisma
- [ ] #3 DATABASE_URL documented in .env.example
- [ ] #4 Initial migration runs cleanly against a local Postgres
- [ ] #5 A typed Prisma client is exposed via src/lib/server/db.ts (or similar) for use in load/actions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Add prisma (dev) and @prisma/client deps via bun.
2. Run `bunx prisma init --datasource-provider postgresql`.
3. Define a minimal starter model and run `prisma migrate dev`.
4. Wire a singleton PrismaClient in src/lib/server/ for SvelteKit server code.
5. Update README / .env.example with DATABASE_URL instructions.
<!-- SECTION:PLAN:END -->
