---
id: LIT-2
title: Set up Playwright e2e tests with DB isolation
status: Done
assignee: []
created_date: '2026-05-17 14:38'
updated_date: '2026-11-13 20:37'
labels:
  - chore
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wire Playwright e2e tests to run against an isolated database per worker so suites don't share state with dev or with each other.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each Playwright worker uses its own database (template + per-worker clone, or per-worker schema/file)
- [x] #2 DB is migrated and seeded automatically before tests; torn down or reset after
- [x] #3 A documented test helper exposes a Prisma client bound to the worker's DB for use in tests
- [x] #4 At least one example e2e spec exercises a DB-backed flow end-to-end
- [x] #5 CI-friendly: no manual setup beyond a single npm/bun script
- [x] #6 README / docs explain how to run e2e tests locally
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a Playwright globalSetup that provisions a template database, runs prisma migrate deploy, and seeds baseline data.
2. In a Playwright fixtures.ts, derive a per-worker DB URL from process.env.TEST_WORKER_INDEX (SQLite: separate file per worker; Postgres: clone the template via CREATE DATABASE ... TEMPLATE).
3. Expose a test fixture that yields a PrismaClient bound to that URL and tears down on worker exit.
4. Add npm run test:e2e prerequisites (ensure DB tooling installed, env vars documented in .env.example).
5. Add a sample spec under e2e/ that creates + reads a record to prove isolation.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Playwright e2e now runs with per-worker Postgres isolation. global-setup builds a template DB (migrate deploy + seed) and builds the app; each worker clones it (CREATE DATABASE ... TEMPLATE) and runs its own vite preview server; global-teardown drops the databases. e2e/fixtures.ts exposes worker-scoped `db` (PrismaClient), `workerDbUrl`, `serverUrl`. Example spec: e2e/db-isolation.e2e.ts. `bun run test:e2e` is the single entry point; README and .env.example document it. Tests: 5/5 e2e specs pass.
<!-- SECTION:FINAL_SUMMARY:END -->
