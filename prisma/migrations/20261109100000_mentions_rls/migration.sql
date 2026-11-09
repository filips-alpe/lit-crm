-- Record mentions under row-level security (lit_record_mention, added by record_mentions).
--
--   read    a mention is visible only when BOTH records it joins are visible (its source,
--           whose text holds the span, and its entity, the record the span names): nobody
--           learns from a mention that a record they cannot see exists or is named somewhere.
--           The gateway needs both records ACTIVE as well (like links).
--   write   insert and delete need WRITE on the source record plus READ on the entity, so a
--           mention of a record you cannot see cannot be planted, and you cannot probe the
--           entity's existence through it. A mention is never updated (no UPDATE grant, no
--           policy). Admin: everything.
--   text    mentions are character offsets into the source's text. When the app edits the
--           text, every mention of that source is dropped, including those whose entity the
--           editor cannot see (a definer trigger: the delete policy would skip them and
--           leave offsets that point at the wrong words for everybody else).
--   grants  lit_app: SELECT, INSERT, DELETE. lit_gateway: SELECT. Nothing else.
--
-- A record's delete cascades its mentions as the table owner (like links), so a writer can
-- delete a record that others' mentions point at.

GRANT SELECT, INSERT, DELETE ON lit_record_mention TO lit_app;
GRANT SELECT ON lit_record_mention TO lit_gateway;

ALTER TABLE lit_record_mention ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_select ON lit_record_mention FOR SELECT TO lit_app, lit_gateway
  USING ((SELECT lit_current_user_is_admin())
         OR ("sourceId" IN (SELECT lit_record_ids('read')) AND "entityId" IN (SELECT lit_record_ids('read'))));
CREATE POLICY rls_insert ON lit_record_mention FOR INSERT TO lit_app
  WITH CHECK ((SELECT lit_current_user_is_admin())
              OR ("sourceId" IN (SELECT lit_record_ids('write')) AND "entityId" IN (SELECT lit_record_ids('read'))));
CREATE POLICY rls_delete ON lit_record_mention FOR DELETE TO lit_app
  USING ((SELECT lit_current_user_is_admin())
         OR ("sourceId" IN (SELECT lit_record_ids('write')) AND "entityId" IN (SELECT lit_record_ids('read'))));
-- the gateway sees a mention only when both records are visible to it, i.e. ACTIVE as well
-- (these sub-selects are filtered by the record policies).
CREATE POLICY gateway_active ON lit_record_mention AS RESTRICTIVE FOR SELECT TO lit_gateway
  USING (EXISTS (SELECT 1 FROM lit_record r WHERE r.id = lit_record_mention."sourceId")
         AND EXISTS (SELECT 1 FROM lit_record r WHERE r.id = lit_record_mention."entityId"));

-- Text edit by the app drops all mentions of the record (see "text" above). Only the trigger
-- does this: it is a SECURITY DEFINER trigger function (a trigger function cannot be called
-- directly, and firing it needs no EXECUTE), so no callable function can delete mentions of
-- records a session cannot see. Inside a definer current_user is the owner, hence the app
-- role is detected from the session role, as in the lit_record_amount view.
CREATE OR REPLACE FUNCTION lit_guard_mentions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  -- only for the app role (the record update policy already let it write this record);
  -- owner connections keep the plain behaviour
  IF current_setting('role', true) = 'lit_app' AND NEW.text IS DISTINCT FROM OLD.text THEN
    DELETE FROM public.lit_record_mention WHERE "sourceId" = NEW.id;
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS lit_guard_mentions ON lit_record;
CREATE TRIGGER lit_guard_mentions AFTER UPDATE OF text ON lit_record
  FOR EACH ROW EXECUTE FUNCTION lit_guard_mentions();
REVOKE ALL ON FUNCTION lit_guard_mentions() FROM PUBLIC, lit_app;
