---
id: LIT-10
title: 'Permissions F4: real authentication before real data'
status: To Do
assignee: []
created_date: '2026-11-11 18:10'
updated_date: '2026-11-13 13:20'
labels:
  - permissions
dependencies: []
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Login is username-only, so history actors and every policy are only as trustworthy as /login. Needs an owner decision on mechanism (password or SSO) before sizing; split once chosen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Mechanism decided by owner,Split into est-1..3 tickets
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner decision 2026-11-11: keep free username-only login for now; do not start.

Groomed 2026-11-13: not estimated; blocked on owner decision (password vs SSO), owner said do not start.
<!-- SECTION:NOTES:END -->
