---
id: LIT-11
title: 'Record history: paging (before_id), admin REDACT rows, e2e'
status: Done
assignee:
  - '@claude'
created_date: '2026-11-13 13:20'
updated_date: '2026-11-20 01:48'
labels:
  - est-3
  - launch-record-history-ui
dependencies:
  - LIT-8
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the history panel from LIT-8: page older entries with before_id, show REDACT rows to admins only, cover with a Playwright e2e test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Load-more pages older entries using before_id,Admin sees REDACT rows; non-admin does not,e2e test covers paging and admin/non-admin visibility
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. GET /data/[id]/history?before= endpoint over listRecordHistory. 2. Load more button in RecordHistory. 3. e2e: paging (55 saves) and admin/non-admin REDACT visibility.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
poker: 2,3,3 — builds on LIT-8 panel; e2e needs seeded history

Endpoint src/routes/(app)/data/[id]/history/+server.ts (401 signed out, 400 bad cursor); Load more in RecordHistory.svelte. REDACT visibility is enforced by the door (non-admins never receive the row). Validation: server tests (endpoint, repo), client component tests (append, error), e2e/record-history.e2e.ts 2 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Load more pages older entries via before_id (JSON endpoint + button); admin sees REDACT rows, non-admin does not; e2e covers paging (55 saves, 50+5) and admin/non-admin redaction visibility. Verified with server, component and Playwright e2e tests.
<!-- SECTION:FINAL_SUMMARY:END -->
