---
id: LIT-9
title: 'Permissions F3: separate LOGIN role for the app'
status: To Do
assignee: []
created_date: '2026-11-11 18:10'
labels:
  - permissions
dependencies: []
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
App connects as table owner and SET ROLEs to lit_app; raw SQL could RESET ROLE. Create a LOGIN role that is only a member of lit_app, new credential, deploy change, update README Known limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 App connects as non-owner login role,RESET ROLE cannot reach the owner,README F3 updated,Rollout steps documented
<!-- AC:END -->
