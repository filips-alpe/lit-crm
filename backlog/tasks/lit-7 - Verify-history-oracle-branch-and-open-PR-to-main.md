---
id: LIT-7
title: Verify history-oracle branch and open PR to main
status: Done
assignee: []
created_date: '2026-11-11 18:10'
updated_date: '2026-11-11 20:56'
labels:
  - history
dependencies: []
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
17 commits (record_history migration, door, redact, oracle with 24 mutations) are local only, no upstream. Run svelte-check, lint, server vitest (needs separate TEST_DATABASE_URL), full oracle (bun scripts/rls-oracle.ts, all mutations exit 1), then push and open PR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 svelte-check and eslint clean,Server vitest green on a dedicated test DB,Oracle passes on all seeds and every --mutate exits 1,Branch pushed and PR opened against main
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified (check, lint, 255 server tests, oracle, 23 mutations), fixed an oracle model gap for owner-deleted link-only records, pushed, PR #13.
<!-- SECTION:FINAL_SUMMARY:END -->
