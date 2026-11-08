-- Security review fixes (grants on row-level security).
--
-- F1  no amount oracle. The old guard raised only when an amount VALUE changed, so
--     "UPDATE ... SET sum = <guess>" succeeding or failing told a writer whose amounts are
--     masked whether the guess was right. Now any UPDATE that names sum, hours or total
--     (BEFORE UPDATE OF ...) raises for a non-admin without amounts access to that record,
--     whatever the value. The app does not send amount columns when they are masked.
-- F2  linking a record into a project, or unlinking it, needs WRITE on the record AND the
--     right to put records into that project: admin, the project's creator or assignee,
--     or a WRITE grant on the project (new lit_project_ids mode 'link'). A READ grant on
--     the project is no longer enough. The project ROW edit right ('write') is unchanged.
-- F6  warn when an existing lit_app / lit_gateway role is not what the model assumes.

-- ===== F1 =====
CREATE OR REPLACE FUNCTION lit_guard_record() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user <> 'lit_app' THEN RETURN NEW; END IF;
  IF lit_current_user_is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW."creatorId" IS DISTINCT FROM OLD."creatorId" THEN
    RAISE EXCEPTION 'creator is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION lit_guard_amounts() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user <> 'lit_app' THEN RETURN NEW; END IF;
  IF lit_current_user_is_admin() THEN RETURN NEW; END IF;
  -- fires for every UPDATE that names an amount column, even with an unchanged value
  IF NOT EXISTS (SELECT 1 FROM lit_record_ids('amounts') x WHERE x = OLD.id) THEN
    RAISE EXCEPTION 'amounts are hidden from you' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS lit_guard_amounts ON lit_record;
CREATE TRIGGER lit_guard_amounts BEFORE UPDATE OF "sum", "hours", "total" ON lit_record
  FOR EACH ROW EXECUTE FUNCTION lit_guard_amounts();
REVOKE ALL ON FUNCTION lit_guard_amounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lit_guard_amounts() TO lit_app;

-- ===== F2 =====
-- 'link': projects the acting user may put records into or take records out of: admin,
-- creator, assignee, or a WRITE grant on the project (to the user or one of their groups).
CREATE OR REPLACE FUNCTION lit_project_ids(mode text) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET jit = off
AS $$
  WITH me AS (
    SELECT lit_current_user_id() AS id WHERE mode IN ('read', 'write', 'link')
  )
  SELECT p.id FROM public.lit_project p WHERE (SELECT lit_current_user_is_admin() AND EXISTS (SELECT 1 FROM me))
  UNION
  SELECT p.id FROM public.lit_project p, me WHERE p."creatorId" = me.id
  UNION
  SELECT p.id FROM public.lit_project p, me WHERE p."assigneeId" = me.id
  UNION
  SELECT gr."projectId" FROM public.lit_grant gr, me
  WHERE mode IN ('read', 'link') AND gr."projectId" IS NOT NULL
    AND (mode = 'read' OR gr.level = 'WRITE')
    AND (gr."userId" = me.id
         OR gr."groupId" IN (SELECT m."groupId" FROM public.lit_group_member m WHERE m."userId" = me.id))
$$;

DROP POLICY rls_insert ON lit_project_record;
DROP POLICY rls_delete ON lit_project_record;
CREATE POLICY rls_insert ON lit_project_record FOR INSERT TO lit_app
  WITH CHECK ((SELECT lit_current_user_is_admin())
              OR ("recordId" IN (SELECT lit_record_ids('write')) AND "projectId" IN (SELECT lit_project_ids('link'))));
CREATE POLICY rls_delete ON lit_project_record FOR DELETE TO lit_app
  USING ((SELECT lit_current_user_is_admin())
         OR ("recordId" IN (SELECT lit_record_ids('write')) AND "projectId" IN (SELECT lit_project_ids('link'))));

-- ===== F6 =====
-- The roles are created only when missing (earlier migration). One that already existed
-- may have been set up differently; say so, loudly, instead of silently inheriting it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT rolname, rolcanlogin, rolbypassrls, rolsuper FROM pg_roles
           WHERE rolname IN ('lit_app', 'lit_gateway') LOOP
    IF r.rolcanlogin OR r.rolbypassrls OR r.rolsuper THEN
      RAISE WARNING 'role % has LOGIN=%, BYPASSRLS=%, SUPERUSER=%: the grants model assumes NOLOGIN NOBYPASSRLS NOSUPERUSER (a role with BYPASSRLS or SUPERUSER ignores every policy). Fix it: ALTER ROLE % NOLOGIN NOBYPASSRLS NOSUPERUSER;',
        r.rolname, r.rolcanlogin, r.rolbypassrls, r.rolsuper, r.rolname;
    END IF;
  END LOOP;
END
$$;
