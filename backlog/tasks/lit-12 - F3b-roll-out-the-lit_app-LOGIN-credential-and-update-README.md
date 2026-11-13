---
id: LIT-12
title: 'F3b: roll out the lit_app LOGIN credential and update README'
status: To Do
assignee: []
created_date: '2026-11-13 13:20'
labels:
  - est-2
dependencies:
  - LIT-9
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provision the new LOGIN role credential on Neon/Vercel, switch DATABASE_URL, document rollout steps and remove F3 from README Known limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Rollout steps documented,Prod and preview use the non-owner login role,README F3 limit updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
poker: 2,2,3 — ops steps on Neon/Vercel; owner must supply/approve credentials
<!-- SECTION:NOTES:END -->
