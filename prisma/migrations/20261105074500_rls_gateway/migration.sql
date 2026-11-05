-- Row-level security for the read-only gateway (Groundtruth).
--
-- Rule: a user sees the records they created or are assigned to, plus every
-- record in a project they created or are assigned to. An admin (lit_user.isAdmin)
-- sees everything. The acting user comes from the per-transaction setting
-- app.user_id; unset or empty means "nobody" and every row is hidden.
--
-- The lit-crm app connects as the table owner and is NOT subject to these
-- policies (no FORCE ROW LEVEL SECURITY), so it behaves exactly as before.
-- Only the NOLOGIN role lit_gateway is constrained. Prisma ignores policies,
-- roles and grants, so this causes no schema drift.

-- 1. The role. Roles are cluster-wide, so create it only if missing. It has no
--    LOGIN and no password: a login role for the gateway is created outside
--    migrations (see delivery/lit-crm-gateway/README.md) and made a member.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lit_gateway') THEN
    CREATE ROLE lit_gateway NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- 2. Helpers. The acting user id (NULL when unset/empty).
CREATE FUNCTION lit_current_user_id() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;

-- Projects visible to the acting user. SECURITY DEFINER (runs as the owner, so
-- it reads lit_user and lit_project without being filtered by their own
-- policies) with a fixed search_path. This is what breaks the policy
-- recursion: record policy -> lit_project_record policy -> this function ->
-- plain table reads, never back into lit_record.
CREATE FUNCTION lit_visible_project_ids() RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id FROM public.lit_project p
  WHERE p.id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.lit_user u
              WHERE u.id = public.lit_current_user_id() AND u."isAdmin")
      OR p."creatorId" = public.lit_current_user_id()
      OR p."assigneeId" = public.lit_current_user_id()
    )
$$;

-- Is the acting user an admin? Same definer/search_path treatment.
CREATE FUNCTION lit_current_user_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
    (SELECT u."isAdmin" FROM public.lit_user u WHERE u.id = public.lit_current_user_id()),
    false)
$$;

REVOKE ALL ON FUNCTION lit_current_user_id(), lit_visible_project_ids(), lit_current_user_is_admin() FROM PUBLIC;

-- 3. Privileges: SELECT only, no writes, no other objects.
GRANT USAGE ON SCHEMA public TO lit_gateway;
GRANT SELECT ON lit_user, lit_type, lit_project, lit_record, lit_project_record TO lit_gateway;
GRANT EXECUTE ON FUNCTION lit_current_user_id(), lit_visible_project_ids(), lit_current_user_is_admin() TO lit_gateway;

-- 4. Policies. lit_user and lit_type stay readable (no RLS).
ALTER TABLE lit_project ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_project_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY gateway_read ON lit_project FOR SELECT TO lit_gateway
  USING (id IN (SELECT lit_visible_project_ids()));

-- Links are visible when their project is. Does not mention lit_record.
CREATE POLICY gateway_read ON lit_project_record FOR SELECT TO lit_gateway
  USING ("projectId" IN (SELECT lit_visible_project_ids()));

CREATE POLICY gateway_read ON lit_record FOR SELECT TO lit_gateway
  USING (
    lit_current_user_is_admin()
    OR "creatorId" = lit_current_user_id()
    OR "assigneeId" = lit_current_user_id()
    OR EXISTS (
      SELECT 1 FROM lit_project_record pr
      WHERE pr."recordId" = lit_record.id
        AND pr."projectId" IN (SELECT lit_visible_project_ids())
    )
  );
