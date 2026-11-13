---
id: LIT-11
title: 'Record history: paging (before_id), admin REDACT rows, e2e'
status: To Do
assignee: []
created_date: '2026-11-13 13:20'
updated_date: '2026-11-13 15:04'
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
- [ ] #1 Load-more pages older entries using before_id,Admin sees REDACT rows; non-admin does not,e2e test covers paging and admin/non-admin visibility
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
poker: 2,3,3 — builds on LIT-8 panel; e2e needs seeded history
<!-- SECTION:NOTES:END -->
