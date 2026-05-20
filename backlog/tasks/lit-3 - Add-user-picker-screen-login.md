---
id: LIT-3
title: Add user picker screen (/login)
status: To Do
assignee: []
created_date: '2026-05-17 15:04'
labels:
  - feature
dependencies:
  - LIT-1
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add a /login route that lists existing users and lets you click one to sign in as them. Dev/demo-grade auth shortcut — no password — to unblock building authenticated CRM views before real auth lands.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A /login route renders a list of all users from the DB
- [ ] #2 Each user is clickable; clicking sets a session/cookie identifying that user
- [ ] #3 After picking, the user is redirected to / (or the original ?redirectTo target)
- [ ] #4 Visiting /login while already signed in still allows switching users
- [ ] #5 If no users exist, the screen shows an empty-state message
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Add a server load in src/routes/login/+page.server.ts that queries all users via Prisma.
2. Render the list in src/routes/login/+page.svelte with a form per user (POST action 'pick' with userId).
3. In the form action, set a signed cookie (e.g. 'session_user_id') and redirect to redirectTo || '/'.
4. Add a hooks.server.ts handle that reads the cookie and populates event.locals.user for downstream routes.
5. Add app.d.ts typing for locals.user.
<!-- SECTION:PLAN:END -->
