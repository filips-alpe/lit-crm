---
id: LIT-17
title: >-
  Tool launchers: spin up Dolibarr/Odoo/Twenty/Evidence with a data subset or a
  user's full visible data
status: To Do
assignee: []
created_date: '2026-11-16 20:13'
labels:
  - integrations
  - docker
dependencies: []
references:
  - ~/conductor/archive-itcrm/
  - 'https://github.com/itcrm/itcrm'
priority: medium
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lit-crm should make it easy to start third-party tools (Dolibarr, Odoo, Twenty, Evidence, NocoDB) preloaded with either a chosen selection of records or everything a given user is allowed to see.

Prior art lives in the old itcrm Conductor workspaces (legacy PHP app, github.com/itcrm/itcrm). Patches are rescued locally in ~/conductor/archive-itcrm/<workspace>/ (commits/, dirty.patch, untracked.tgz):
- gwangju-v1: Dolibarr dev override, SQLite importer (docker/dolibarr-import.sh), dolibarr-sync e2e
- surabaya: Odoo compose, docker/odoo-run.ts, odoo.conf
- honolulu-v1: Twenty CRM run script
- tirana: Evidence docker compose and config
- ~/projects/itcrm/docker/nocodb-init.sh: NocoDB override
- islamabad: forms registry/schema and receipt parser (ideas only)

Rebase/port the experiments onto lit-crm instead of copying the PHP-specific importers: docker-compose overrides plus a launcher script per tool, fed by a shared export step that reads lit-crm records through the permission model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shared export step produces a tool-neutral dataset from (a) an explicit record selection or (b) all records a given user can access, honouring lit-crm permissions (a restricted user never gets rows they cannot read)
- [ ] #2 One command per tool (Dolibarr, Odoo at minimum) starts the container and loads the exported dataset; Twenty/Evidence/NocoDB follow the same pattern or are split into follow-up tickets
- [ ] #3 Each launcher maps lit-crm types and fields to the tool's import format, with the mapping documented in the README
- [ ] #4 An e2e smoke test starts Dolibarr with a small selection and asserts the records appear
- [ ] #5 Ported code is rebased onto current main from the archived patches; no PHP importer code is carried over
<!-- AC:END -->
