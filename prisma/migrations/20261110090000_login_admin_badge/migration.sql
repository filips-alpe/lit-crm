-- The login picker shows an admin badge, so lit_login_users() also returns isAdmin.
-- A changed result type needs DROP + CREATE; the privileges are restored as in grants_rls.
-- isAdmin was already reachable without a secret through lit_resolve_user(); see README F4.
DROP FUNCTION lit_login_users();

CREATE FUNCTION lit_login_users()
  RETURNS TABLE (id text, username text, name text, color text, "avatarSeed" text, "isAdmin" boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.username, u.name, u.color, u."avatarSeed", u."isAdmin" FROM public.lit_user u
  WHERE u.status = 'ACTIVE' ORDER BY u.name
$$;

REVOKE ALL ON FUNCTION lit_login_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lit_login_users() TO lit_app, lit_gateway;
