---
id: LIT-8
title: 'Record history panel: newest-first list on the record page'
status: To Do
assignee: []
created_date: '2026-11-11 18:10'
updated_date: '2026-11-13 13:20'
labels:
  - history
  - est-3
dependencies: []
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lit_record_history has no UI yet. Add a history panel on the record page using the door (paging with before_id, masked amounts, REDACT rows for admins), i18n keys per CLAUDE.md, e2e test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Record page lists history newest first with paging,Non-admin sees no hidden-period rows,Admin sees redaction rows,e2e test covers it
- [ ] #2 Record page shows a history panel listing entries newest first via the door,Non-admin sees no hidden-period rows,i18n keys added per CLAUDE.md
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
poker: 3,3,5 — UI panel + door load + i18n; split paging/admin/e2e into a follow-up to keep slices small
<!-- SECTION:NOTES:END -->
