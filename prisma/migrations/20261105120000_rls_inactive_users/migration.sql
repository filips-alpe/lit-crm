-- Inactive users (lit_user.status <> 'ACTIVE') see nothing through the gateway role.
--
-- Every policy and helper of the rls_gateway migration identifies the acting
-- user through lit_current_user_id(). Making that function return NULL for a
-- missing, unknown or inactive user denies them everywhere at once: the record
-- policy (creator/assignee match), lit_visible_project_ids() (project creator/
-- assignee match and the admin check) and lit_current_user_is_admin() all look
-- the user up by this id. An inactive admin therefore loses the admin view too.
--
-- The previous definition was a plain setting read; this one also reads
-- lit_user, which lit_gateway may SELECT (it has no policy). It is not
-- SECURITY DEFINER: it needs nothing the caller lacks, and as a plain
-- invoker function it cannot be used to read anything else.
CREATE OR REPLACE FUNCTION lit_current_user_id() RETURNS text
LANGUAGE sql STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT u.id FROM public.lit_user u
  WHERE u.id = nullif(current_setting('app.user_id', true), '')
    AND u.status = 'ACTIVE'
$$;

-- The function now reads a table, so Postgres can no longer inline it and would
-- call it once per row. Wrapping each call in a scalar sub-select turns it into
-- an InitPlan evaluated once per statement. Same rule as before, recreated
-- only for speed.
DROP POLICY gateway_read ON lit_record;
CREATE POLICY gateway_read ON lit_record FOR SELECT TO lit_gateway
  USING (
    (SELECT lit_current_user_is_admin())
    OR "creatorId" = (SELECT lit_current_user_id())
    OR "assigneeId" = (SELECT lit_current_user_id())
    OR EXISTS (
      SELECT 1 FROM lit_project_record pr
      WHERE pr."recordId" = lit_record.id
        AND pr."projectId" IN (SELECT lit_visible_project_ids())
    )
  );
