---
id: LIT-9
title: 'F3a: LOGIN role limited to lit_app (migration + RESET ROLE test)'
status: To Do
assignee: []
created_date: '2026-11-11 18:10'
updated_date: '2026-11-13 15:04'
labels:
  - permissions
  - est-3
  - launch-lit-app-login-role
dependencies: []
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
App connects as table owner and SET ROLEs to lit_app; raw SQL could RESET ROLE. Create a LOGIN role that is only a member of lit_app, new credential, deploy change, update README Known limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Migration creates a LOGIN role that is a member of lit_app only and cannot SET ROLE to the owner,Server test proves RESET ROLE cannot reach the owner,App connects via the new role locally
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
poker: 3,3,5 — role grants + test are well-bounded; credential/deploy split to its own ticket
<!-- SECTION:NOTES:END -->
