---
id: LIT-8
title: 'Record history panel: newest-first list on the record page'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-11 18:10'
updated_date: '2026-11-20 01:44'
labels:
  - history
  - est-3
  - launch-record-history-ui
dependencies: []
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lit_record_history has no UI yet. Add a history panel on the record page using the door (paging with before_id, masked amounts, REDACT rows for admins), i18n keys per CLAUDE.md, e2e test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Record page shows a history panel listing entries newest first via the door,Non-admin sees no hidden-period rows,i18n keys added per CLAUDE.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Repo listRecordHistory (door lit_record_history, actor names, project codes, beforeId cursor) with tests. 2. Load history in /data/[id]; RecordHistory panel under the record. 3. i18n keys en+lv. 4. Tests: repo, load, component. Paging UI, REDACT visibility e2e = LIT-11.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
poker: 3,3,5 — UI panel + door load + i18n; split paging/admin/e2e into a follow-up to keep slices small

Door via listRecordHistory (src/lib/server/repos/history.ts); first page loaded in /data/[id], drawn by RecordHistory.svelte. Hidden-period rows: door-enforced, covered by repo test 'nothing from the period the record was hidden'. Validation: server 267, unit 305, client 101 tests pass; svelte-check 0 errors. REDACT rendering exists; paging UI + e2e left to LIT-11.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
History panel on /data/[id]: newest-first first page (50) from lit_record_history with actor names, labelled changed values, project link rows; i18n en+lv. Verified with repo tests (order, paging cursor, non-admin hidden period, REDACT admin-only, deleted actor), load test, component test, svelte-check.
<!-- SECTION:FINAL_SUMMARY:END -->
