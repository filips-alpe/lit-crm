---
id: LIT-18
title: >-
  Record history follow-ups: exact Load more, readable values, panel on
  /page/[id]
status: Done
assignee: []
created_date: '2026-11-20 05:22'
updated_date: '2026-11-20 05:28'
labels:
  - history
dependencies: []
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-ups to LIT-8/LIT-11. 1) nextBefore is set whenever a page is full, so the last Load more can return empty: fetch limit+1 so it is null when nothing older exists. 2) Updates show raw ISO dates and relation ids: format dates with formatDate/formatTime, resolve creator/assignee/linked-record ids to names/titles through the RLS-respecting prisma client; unreadable shows 'hidden record'. 3) Show the panel on /page/[id] (single-record best page; fits under BestPage).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Load more hides when nothing older exists (tested); update values show locale dates and resolved relation titles, hidden shows neutral label (tested); panel renders on /page/[id] (tested)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
nextBefore now set only when a limit+1 row exists; relation ids resolved via RLS-bound prisma (hidden shows 'hidden record'); dates via formatDate/formatTime; panel added to /page/[id]. Check, vitest (693), eslint, record-history e2e pass.
<!-- SECTION:FINAL_SUMMARY:END -->
