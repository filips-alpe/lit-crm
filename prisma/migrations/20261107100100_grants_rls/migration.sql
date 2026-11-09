-- Grants as data on Postgres row-level security.
--
-- Replaces the hard-coded gateway policy of rls_gateway / rls_inactive_users with
-- one rule set shared by two non-owner roles:
--
--   lit_app      the lit-crm app (it switches to this role per request, in a
--                transaction, and sets app.user_id); reads and writes
--   lit_gateway  the read-only AI-chat gateway; SELECT only, and only ACTIVE
--                records and projects
--
-- WHO MAY TOUCH A RECORD (the acting user is the active user named by app.user_id;
-- unset, unknown or INACTIVE means nobody and every table is empty):
--   * an admin (lit_user.isAdmin): everything, hidden records included
--   * everyone else, NEVER a hidden record (lit_record.hidden is admin-only), and
--       - implicit WRITE: records they created or are assigned to, and every record
--         in a project they created or are assigned to
--       - grants (lit_grant), made to the user or to a group they belong to, with
--         scope person (records whose creator OR assignee is that person), project
--         (records linked to it), type or record, at level READ or WRITE (WRITE
--         includes read). All paths are OR-ed; the highest level wins.
-- PROJECT ROWS: readable through creator/assignee or any project grant; editable only
--   by the project's creator, its assignee or an admin (a project WRITE grant covers
--   the project's records, not the project row). The project row's hard delete is
--   the same set (creator, assignee, admin). A RECORD may be hard-deleted by anyone
--   who may write it (exactly the UPDATE set, admins included); everyone else sets
--   status INACTIVE.
-- LINKS (lit_project_record): visible only when BOTH the record and the project are.
-- AMOUNTS: sum, hours and total are shown when ANY path to the record shows them
--   (admin, implicit, or a grant without hideAmounts), else NULL. The restricted
--   roles have no column privilege on them; the only door is view lit_record_amount.
-- USERS and TYPES: readable by any active user; types are admin-write only; a user
--   edits their own profile, but only an admin changes identity, status or isAdmin.
-- GROUPS, MEMBERSHIPS, GRANTS: a user reads only their own rows (a grant made to
--   them or to one of their groups, their own memberships, groups they belong to);
--   an admin reads all and is the only one who writes.
--
-- The owner (the migrating role) is not subject to the policies (no FORCE ROW LEVEL
-- SECURITY), so migrations, seeds and an app that has not switched to lit_app yet
-- behave as before. Prisma ignores roles, policies, functions, triggers, views and
-- grants, so none of this causes schema drift. Every new column of lit_record needs
-- a column grant (see section 6); a server test enforces it.

-- ===== 1. Roles =====
-- Roles are cluster-wide: create them only when missing. Neither can log in. A
-- CREATEROLE owner (Neon) may create them; if a role already exists and the owner
-- cannot grant it, the app is blocked until an admin runs the printed GRANT.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lit_gateway') THEN
    CREATE ROLE lit_gateway NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lit_app') THEN
    CREATE ROLE lit_app NOLOGIN NOINHERIT;
  END IF;
  -- The connecting (owner) role must be able to SET ROLE lit_app.
  BEGIN
    EXECUTE format('GRANT lit_app TO %I', current_user);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'could not GRANT lit_app TO %; an admin must run: GRANT lit_app TO %;', current_user, current_user;
  END;
END
$$;

-- ===== 2. Retire the hard-coded gateway policy =====
DROP POLICY IF EXISTS gateway_read ON lit_project;
DROP POLICY IF EXISTS gateway_read ON lit_project_record;
DROP POLICY IF EXISTS gateway_read ON lit_record;
DROP FUNCTION IF EXISTS lit_visible_project_ids();

-- ===== 3. Helpers =====
-- All SECURITY DEFINER (they run as the owner, so they read the tables without being
-- filtered by the policies that call them: this is what prevents policy recursion),
-- with a fixed search_path, STABLE. Callers are the policies, the amount view and the
-- guard triggers; there is one definition of "what may this user touch".

-- The acting user's id: NULL when app.user_id is unset, unknown or INACTIVE.
CREATE OR REPLACE FUNCTION lit_current_user_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT u.id FROM public.lit_user u
  WHERE u.id = nullif(current_setting('app.user_id', true), '') AND u.status = 'ACTIVE'
$$;

CREATE OR REPLACE FUNCTION lit_current_user_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT coalesce((SELECT u."isAdmin" FROM public.lit_user u
                   WHERE u.id = nullif(current_setting('app.user_id', true), '') AND u.status = 'ACTIVE'), false)
$$;

-- The groups the acting user belongs to.
CREATE OR REPLACE FUNCTION lit_current_group_ids() RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m."groupId" FROM public.lit_group_member m WHERE m."userId" = public.lit_current_user_id()
$$;

-- Records the acting user may touch, by mode: 'read' | 'write' | 'amounts' (amounts =
-- sum, hours and total are shown). Any other mode returns nothing. jit is pinned off:
-- JIT compilation cost more than the query itself in measurements.
CREATE OR REPLACE FUNCTION lit_record_ids(mode text) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET jit = off
AS $$
  WITH me AS (
    SELECT lit_current_user_id() AS id WHERE mode IN ('read', 'write', 'amounts')
  ),
  g AS (
    SELECT gr."personId", gr."projectId", gr."typeId", gr."recordId"
    FROM public.lit_grant gr, me
    WHERE me.id IS NOT NULL
      AND (gr."userId" = me.id
           OR gr."groupId" IN (SELECT m."groupId" FROM public.lit_group_member m WHERE m."userId" = me.id))
      AND CASE mode WHEN 'write' THEN gr.level = 'WRITE'
                    WHEN 'amounts' THEN NOT gr."hideAmounts"
                    ELSE true END
  )
  -- admin: everything, hidden included
  SELECT r.id FROM public.lit_record r WHERE (SELECT lit_current_user_is_admin() AND EXISTS (SELECT 1 FROM me))
  UNION
  -- implicit: creator / assignee
  SELECT r.id FROM public.lit_record r, me WHERE NOT r.hidden AND r."creatorId" = me.id
  UNION
  SELECT r.id FROM public.lit_record r, me WHERE NOT r.hidden AND r."assigneeId" = me.id
  UNION
  -- implicit: records of projects I created / am assigned to
  SELECT pr."recordId" FROM public.lit_project p, me, public.lit_project_record pr, public.lit_record r
  WHERE p."creatorId" = me.id AND pr."projectId" = p.id AND r.id = pr."recordId" AND NOT r.hidden
  UNION
  SELECT pr."recordId" FROM public.lit_project p, me, public.lit_project_record pr, public.lit_record r
  WHERE p."assigneeId" = me.id AND pr."projectId" = p.id AND r.id = pr."recordId" AND NOT r.hidden
  UNION
  -- grants: by type, by person (creator or assignee), by record, by project
  SELECT r.id FROM g JOIN public.lit_record r ON r."typeId" = g."typeId" WHERE NOT r.hidden
  UNION
  SELECT r.id FROM g JOIN public.lit_record r ON r."creatorId" = g."personId" WHERE NOT r.hidden
  UNION
  SELECT r.id FROM g JOIN public.lit_record r ON r."assigneeId" = g."personId" WHERE NOT r.hidden
  UNION
  SELECT r.id FROM g JOIN public.lit_record r ON r.id = g."recordId" WHERE NOT r.hidden
  UNION
  SELECT pr."recordId" FROM g JOIN public.lit_project_record pr ON pr."projectId" = g."projectId"
    JOIN public.lit_record r ON r.id = pr."recordId" WHERE NOT r.hidden
$$;

-- Projects the acting user may touch, by mode: 'read' | 'write'. 'write' (the project
-- ROW: code, description, assignee ...) is admin, creator or assignee only; a project
-- grant of either level makes the project readable and, through lit_record_ids, its
-- records readable or writable, but never the project row editable.
CREATE OR REPLACE FUNCTION lit_project_ids(mode text) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET jit = off
AS $$
  WITH me AS (
    SELECT lit_current_user_id() AS id WHERE mode IN ('read', 'write')
  )
  SELECT p.id FROM public.lit_project p WHERE (SELECT lit_current_user_is_admin() AND EXISTS (SELECT 1 FROM me))
  UNION
  SELECT p.id FROM public.lit_project p, me WHERE p."creatorId" = me.id
  UNION
  SELECT p.id FROM public.lit_project p, me WHERE p."assigneeId" = me.id
  UNION
  SELECT gr."projectId" FROM public.lit_grant gr, me
  WHERE mode = 'read' AND gr."projectId" IS NOT NULL
    AND (gr."userId" = me.id
         OR gr."groupId" IN (SELECT m."groupId" FROM public.lit_group_member m WHERE m."userId" = me.id))
$$;

-- Login picker and gateway identity lookup. No acting user exists yet, so these two
-- narrow definer functions replace table access (lit_user is under RLS now).
CREATE OR REPLACE FUNCTION lit_login_users() RETURNS TABLE (id text, username text, name text, color text, "avatarSeed" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.username, u.name, u.color, u."avatarSeed" FROM public.lit_user u
  WHERE u.status = 'ACTIVE' ORDER BY u.name
$$;

CREATE OR REPLACE FUNCTION lit_resolve_user(p_username text) RETURNS TABLE (id text, name text, "isAdmin" boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.name, u."isAdmin" FROM public.lit_user u
  WHERE u.username = p_username AND u.status = 'ACTIVE'
$$;

-- ===== 4. Amounts: the only door to sum, hours and total =====
-- Owner-run (not security_invoker), so it reads the columns the restricted roles
-- cannot; it returns one row per record the acting user can read, with the three
-- amounts NULL and masked = true when no access path shows them. Row filter and mask
-- come from the same set functions as the policies. canWrite = the user may UPDATE
-- the record. Records that are not ACTIVE are visible only to the app role (the
-- 'role' setting is tested because current_user inside an owner-run view is the owner):
-- any other role (the gateway) sees ACTIVE records only, like the table policies.
-- security_barrier: quals the caller adds never run before the view's own filter.
CREATE VIEW lit_record_amount WITH (security_barrier = true) AS
SELECT r.id AS "recordId",
       CASE WHEN a.id IS NOT NULL THEN r."sum" END   AS "sum",
       CASE WHEN a.id IS NOT NULL THEN r."hours" END AS "hours",
       CASE WHEN a.id IS NOT NULL THEN r."total" END AS "total",
       (a.id IS NULL) AS "masked",
       (adm.v OR w.id IS NOT NULL) AS "canWrite"
FROM public.lit_record r
CROSS JOIN (SELECT lit_current_user_is_admin() AS v) adm
LEFT JOIN (SELECT x AS id FROM lit_record_ids('amounts') x) a ON a.id = r.id
LEFT JOIN (SELECT x AS id FROM lit_record_ids('write') x) w ON w.id = r.id
WHERE (adm.v OR r.id IN (SELECT lit_record_ids('read')))
  AND (r.status = 'ACTIVE' OR current_setting('role') = 'lit_app');

-- ===== 5. Guard triggers: what a policy cannot express (OLD against NEW) =====
-- They act only for lit_app, so migrations, seeds and the owner are unaffected.

CREATE OR REPLACE FUNCTION lit_guard_record() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user <> 'lit_app' THEN RETURN NEW; END IF;
  IF lit_current_user_is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."creatorId" IS DISTINCT FROM OLD."creatorId" THEN
      RAISE EXCEPTION 'creator is immutable' USING ERRCODE = '42501';
    END IF;
    IF NEW."sum" IS DISTINCT FROM OLD."sum" OR NEW."hours" IS DISTINCT FROM OLD."hours"
       OR NEW."total" IS DISTINCT FROM OLD."total" THEN
      IF NOT EXISTS (SELECT 1 FROM lit_record_ids('amounts') x WHERE x = OLD.id) THEN
        RAISE EXCEPTION 'amounts are hidden from you' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER lit_guard_record BEFORE INSERT OR UPDATE ON lit_record
  FOR EACH ROW EXECUTE FUNCTION lit_guard_record();

CREATE OR REPLACE FUNCTION lit_guard_project() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user <> 'lit_app' THEN RETURN NEW; END IF;
  IF NEW."creatorId" IS DISTINCT FROM OLD."creatorId" AND NOT lit_current_user_is_admin() THEN
    RAISE EXCEPTION 'creator is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER lit_guard_project BEFORE UPDATE ON lit_project
  FOR EACH ROW EXECUTE FUNCTION lit_guard_project();

CREATE OR REPLACE FUNCTION lit_guard_user() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user <> 'lit_app' THEN RETURN NEW; END IF;
  IF NOT lit_current_user_is_admin() AND (
       NEW."isAdmin" IS DISTINCT FROM OLD."isAdmin" OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.username IS DISTINCT FROM OLD.username OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'only an admin may change identity, status or isAdmin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER lit_guard_user BEFORE UPDATE ON lit_user
  FOR EACH ROW EXECUTE FUNCTION lit_guard_user();

-- ===== 6. Privileges =====
REVOKE ALL ON FUNCTION lit_current_user_id(), lit_current_user_is_admin(), lit_current_group_ids(),
  lit_record_ids(text), lit_project_ids(text), lit_login_users(), lit_resolve_user(text),
  lit_guard_record(), lit_guard_project(), lit_guard_user() FROM PUBLIC;
-- Policies call the helpers with the privileges of the querying role, so both roles need EXECUTE.
GRANT EXECUTE ON FUNCTION lit_current_user_id(), lit_current_user_is_admin(), lit_current_group_ids(),
  lit_record_ids(text), lit_project_ids(text), lit_login_users(), lit_resolve_user(text)
  TO lit_app, lit_gateway;
-- Trigger functions run as the role that fired the trigger.
GRANT EXECUTE ON FUNCTION lit_guard_record(), lit_guard_project(), lit_guard_user() TO lit_app;

REVOKE ALL ON lit_record_amount FROM PUBLIC;
GRANT SELECT ON lit_record_amount TO lit_app, lit_gateway;

GRANT USAGE ON SCHEMA public TO lit_app, lit_gateway;

-- Gateway: SELECT only, and sum/hours/total only through the view. rls_gateway granted
-- table-level SELECT on lit_record; a column REVOKE cannot narrow a table-level grant,
-- so revoke it and grant the columns one by one. EVERY NEW COLUMN of lit_record needs a
-- GRANT SELECT (column) ON lit_record TO lit_app, lit_gateway (grants.columns.test.ts
-- fails otherwise), unless it is a further amount.
REVOKE ALL ON lit_user, lit_type, lit_project, lit_record, lit_project_record FROM lit_gateway;
GRANT SELECT ON lit_user, lit_type, lit_project, lit_project_record TO lit_gateway;
GRANT SELECT (id, "createdAt", "updatedAt", status, title, description, text, note, "references",
  date, start, "end", "allDay", unit, "from", "to", "fromGeo", "toGeo", "typeId", "creatorId",
  "assigneeId", "recordId", hidden)
  ON lit_record TO lit_gateway;

-- App: full DML where a policy allows it. Links are never updated, only inserted and deleted.
GRANT SELECT, INSERT, UPDATE, DELETE ON lit_user, lit_type, lit_project, lit_group, lit_grant TO lit_app;
GRANT SELECT, INSERT, DELETE ON lit_project_record, lit_group_member TO lit_app;
GRANT SELECT (id, "createdAt", "updatedAt", status, title, description, text, note, "references",
  date, start, "end", "allDay", unit, "from", "to", "fromGeo", "toGeo", "typeId", "creatorId",
  "assigneeId", "recordId", hidden)
  ON lit_record TO lit_app;
GRANT INSERT, UPDATE, DELETE ON lit_record TO lit_app;

-- ===== 7. Row-level security =====
ALTER TABLE lit_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_project ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_project_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_group_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_grant ENABLE ROW LEVEL SECURITY;

-- Policy expressions call the helpers inside a scalar sub-select so Postgres evaluates
-- them once per statement (InitPlan) and builds each id set once (hashed sub-plan).

-- users: any active user reads; an admin inserts and deletes; an admin or the user
-- themself updates (lit_guard_user limits what a non-admin may change)
CREATE POLICY rls_select ON lit_user FOR SELECT TO lit_app, lit_gateway
  USING ((SELECT lit_current_user_id()) IS NOT NULL);
CREATE POLICY rls_insert ON lit_user FOR INSERT TO lit_app
  WITH CHECK ((SELECT lit_current_user_is_admin()));
CREATE POLICY rls_update ON lit_user FOR UPDATE TO lit_app
  USING ((SELECT lit_current_user_is_admin()) OR id = (SELECT lit_current_user_id()))
  WITH CHECK ((SELECT lit_current_user_is_admin()) OR id = (SELECT lit_current_user_id()));
CREATE POLICY rls_delete ON lit_user FOR DELETE TO lit_app
  USING ((SELECT lit_current_user_is_admin()));

-- types: any active user reads; admin writes
CREATE POLICY rls_select ON lit_type FOR SELECT TO lit_app, lit_gateway
  USING ((SELECT lit_current_user_id()) IS NOT NULL);
CREATE POLICY rls_insert ON lit_type FOR INSERT TO lit_app
  WITH CHECK ((SELECT lit_current_user_is_admin()));
CREATE POLICY rls_update ON lit_type FOR UPDATE TO lit_app
  USING ((SELECT lit_current_user_is_admin())) WITH CHECK ((SELECT lit_current_user_is_admin()));
CREATE POLICY rls_delete ON lit_type FOR DELETE TO lit_app
  USING ((SELECT lit_current_user_is_admin()));

-- groups, memberships, grants: own rows only (admin: all); admin writes
CREATE POLICY rls_select ON lit_group FOR SELECT TO lit_app
  USING ((SELECT lit_current_user_is_admin()) OR id IN (SELECT lit_current_group_ids()));
CREATE POLICY rls_select ON lit_group_member FOR SELECT TO lit_app
  USING ((SELECT lit_current_user_is_admin()) OR "userId" = (SELECT lit_current_user_id()));
CREATE POLICY rls_select ON lit_grant FOR SELECT TO lit_app
  USING ((SELECT lit_current_user_is_admin())
         OR "userId" = (SELECT lit_current_user_id())
         OR "groupId" IN (SELECT lit_current_group_ids()));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lit_group', 'lit_group_member', 'lit_grant'] LOOP
    EXECUTE format('CREATE POLICY rls_insert ON %I FOR INSERT TO lit_app WITH CHECK ((SELECT lit_current_user_is_admin()))', t);
    EXECUTE format('CREATE POLICY rls_delete ON %I FOR DELETE TO lit_app USING ((SELECT lit_current_user_is_admin()))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['lit_group', 'lit_grant'] LOOP
    EXECUTE format('CREATE POLICY rls_update ON %I FOR UPDATE TO lit_app USING ((SELECT lit_current_user_is_admin())) WITH CHECK ((SELECT lit_current_user_is_admin()))', t);
  END LOOP;
END
$$;

-- projects. Creator and assignee are also tested inline: an INSERT ... RETURNING or
-- UPDATE ... RETURNING row is checked against the SELECT policy with the statement's
-- snapshot, which a STABLE set function cannot see into.
CREATE POLICY rls_select ON lit_project FOR SELECT TO lit_app, lit_gateway
  USING ((SELECT lit_current_user_is_admin())
         OR "creatorId" = (SELECT lit_current_user_id()) OR "assigneeId" = (SELECT lit_current_user_id())
         OR id IN (SELECT lit_project_ids('read')));
CREATE POLICY rls_insert ON lit_project FOR INSERT TO lit_app
  WITH CHECK ((SELECT lit_current_user_is_admin()) OR "creatorId" = (SELECT lit_current_user_id()));
CREATE POLICY rls_update ON lit_project FOR UPDATE TO lit_app
  USING ((SELECT lit_current_user_is_admin()) OR id IN (SELECT lit_project_ids('write')))
  WITH CHECK ((SELECT lit_current_user_id()) IS NOT NULL);
CREATE POLICY rls_delete ON lit_project FOR DELETE TO lit_app
  USING ((SELECT lit_current_user_is_admin()) OR id IN (SELECT lit_project_ids('write')));
CREATE POLICY gateway_active ON lit_project AS RESTRICTIVE FOR SELECT TO lit_gateway
  USING (status = 'ACTIVE');

-- records (same inline creator/assignee arm for the same reason)
CREATE POLICY rls_select ON lit_record FOR SELECT TO lit_app, lit_gateway
  USING ((SELECT lit_current_user_is_admin())
         OR (NOT hidden AND ("creatorId" = (SELECT lit_current_user_id())
                             OR "assigneeId" = (SELECT lit_current_user_id())))
         OR id IN (SELECT lit_record_ids('read')));
CREATE POLICY rls_insert ON lit_record FOR INSERT TO lit_app
  WITH CHECK ((SELECT lit_current_user_is_admin())
              OR (NOT hidden AND "creatorId" = (SELECT lit_current_user_id())));
-- The new row cannot be judged against the set (it is snapshot-stale), so WITH CHECK only
-- keeps a non-admin from hiding a record; creator is frozen by lit_guard_record.
CREATE POLICY rls_update ON lit_record FOR UPDATE TO lit_app
  USING ((SELECT lit_current_user_is_admin()) OR id IN (SELECT lit_record_ids('write')))
  WITH CHECK ((SELECT lit_current_user_is_admin()) OR NOT hidden);
-- Hard delete follows the write set exactly: whoever may UPDATE a record may DELETE it.
CREATE POLICY rls_delete ON lit_record FOR DELETE TO lit_app
  USING ((SELECT lit_current_user_is_admin()) OR id IN (SELECT lit_record_ids('write')));
CREATE POLICY gateway_active ON lit_record AS RESTRICTIVE FOR SELECT TO lit_gateway
  USING (status = 'ACTIVE');

-- links: visible and writable only when BOTH ends are. No UPDATE policy: a link is
-- inserted or deleted, never changed.
CREATE POLICY rls_select ON lit_project_record FOR SELECT TO lit_app, lit_gateway
  USING ((SELECT lit_current_user_is_admin())
         OR ("recordId" IN (SELECT lit_record_ids('read')) AND "projectId" IN (SELECT lit_project_ids('read'))));
CREATE POLICY rls_insert ON lit_project_record FOR INSERT TO lit_app
  WITH CHECK ((SELECT lit_current_user_is_admin())
              OR ("recordId" IN (SELECT lit_record_ids('write')) AND "projectId" IN (SELECT lit_project_ids('read'))));
CREATE POLICY rls_delete ON lit_project_record FOR DELETE TO lit_app
  USING ((SELECT lit_current_user_is_admin())
         OR ("recordId" IN (SELECT lit_record_ids('write')) AND "projectId" IN (SELECT lit_project_ids('read'))));
-- the gateway sees a link only when both ends are visible to it, i.e. ACTIVE as well (these
-- sub-selects are filtered by the record and project policies above). The outer columns are
-- qualified on purpose: lit_record has a "recordId" column of its own (the self relation).
CREATE POLICY gateway_active ON lit_project_record AS RESTRICTIVE FOR SELECT TO lit_gateway
  USING (EXISTS (SELECT 1 FROM lit_record r WHERE r.id = lit_project_record."recordId")
         AND EXISTS (SELECT 1 FROM lit_project p WHERE p.id = lit_project_record."projectId"));
