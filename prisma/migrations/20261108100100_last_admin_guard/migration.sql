-- The last active admin cannot be removed, enforced in the database so two concurrent
-- demotions cannot both succeed. Acts for the app role only (like the other guards), so
-- migrations, seeds and fixtures are unaffected. A transaction-scoped advisory lock
-- serialises every admin-removing change; the count that follows sees the committed result
-- of whoever held the lock before (a VOLATILE function: each statement gets a fresh
-- snapshot). Only an admin can reach the count (the policies and lit_guard_user stop anyone
-- else from changing an admin row), and an admin reads every user row.
CREATE OR REPLACE FUNCTION lit_guard_last_admin() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user <> 'lit_app' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF OLD."isAdmin" AND OLD.status = 'ACTIVE'
     AND (TG_OP = 'DELETE' OR NOT NEW."isAdmin" OR NEW.status <> 'ACTIVE') THEN
    PERFORM pg_advisory_xact_lock(7261108);
    IF NOT EXISTS (SELECT 1 FROM public.lit_user u
                   WHERE u."isAdmin" AND u.status = 'ACTIVE' AND u.id <> OLD.id) THEN
      RAISE EXCEPTION 'last active admin' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END
$$;
REVOKE ALL ON FUNCTION lit_guard_last_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lit_guard_last_admin() TO lit_app;

CREATE TRIGGER lit_guard_last_admin BEFORE UPDATE OR DELETE ON lit_user
  FOR EACH ROW EXECUTE FUNCTION lit_guard_last_admin();
