-- Record history: who changed what, written by triggers, read through lit_record_history().
--
--   table    lit_history is closed: RLS on with no policy, and every privilege revoked from
--            PUBLIC, lit_app and lit_gateway (table and sequence), so a managed-Postgres
--            default ACL or a later GRANT ... ON ALL TABLES cannot open it.

CREATE TYPE "HistoryAction" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'REDACT');

CREATE TABLE "lit_history" (
  "id" BIGSERIAL NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
  "tableName" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" "HistoryAction" NOT NULL,
  "data" JSONB,
  "changed" TEXT[],
  "actorId" TEXT,

  CONSTRAINT "lit_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lit_history_tableName_entityId_id_idx" ON "lit_history"("tableName", "entityId", "id");
CREATE INDEX "lit_history_actorId_idx" ON "lit_history"("actorId");

ALTER TABLE "lit_history" ADD CONSTRAINT "lit_history_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "lit_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE lit_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lit_history FROM PUBLIC, lit_app, lit_gateway;
REVOKE ALL ON SEQUENCE lit_history_id_seq FROM PUBLIC, lit_app, lit_gateway;

-- ===== Capture =====
--   actor    the acting user (app.user_id). With none (owner writes: seeds, scripts, the
--            oracle; or an unknown or inactive id) nothing is written: history records what
--            users did through the app.
--   data     the row after an INSERT or UPDATE; the row as it was for a DELETE.
--   changed  UPDATE only: the columns whose value differs, `updatedAt` excluded (Prisma
--            bumps it on every save). A save that changes nothing else is not history.
-- SECURITY DEFINER so the app role needs no privilege on lit_history. Tables are
-- schema-qualified and pg_temp is last on the search_path, so a caller's TEMP table named
-- lit_history cannot capture or forge rows.
CREATE FUNCTION lit_capture_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  actor text := public.lit_current_user_id();
  o jsonb;
  n jsonb;
  ch text[];
BEGIN
  IF actor IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' THEN
    o := to_jsonb(OLD);
  ELSE
    n := to_jsonb(NEW);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    o := to_jsonb(OLD);
    SELECT array_agg(e.key ORDER BY e.key) INTO ch
    FROM jsonb_each(n) e WHERE e.key <> 'updatedAt' AND e.value IS DISTINCT FROM o -> e.key;
    IF ch IS NULL THEN RETURN NULL; END IF;
  END IF;
  INSERT INTO public.lit_history ("tableName", "entityId", action, data, changed, "actorId")
  VALUES (TG_TABLE_NAME, COALESCE(n, o) ->> COALESCE(TG_ARGV[0], 'id'), TG_OP::"HistoryAction",
          COALESCE(n, o), ch, actor);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION lit_capture_history() FROM PUBLIC, lit_app, lit_gateway;

CREATE TRIGGER lit_record_history AFTER INSERT OR UPDATE OR DELETE ON lit_record
  FOR EACH ROW EXECUTE FUNCTION lit_capture_history();
CREATE TRIGGER lit_project_record_history AFTER INSERT OR DELETE ON lit_project_record
  FOR EACH ROW EXECUTE FUNCTION lit_capture_history('recordId');
-- No trigger on lit_record_mention: mentions are derived from text (rewritten on every
-- text edit) and their rows name target records the reader may not see.

-- ===== Read door =====
-- The columns of a table that lit_app may SELECT, plus the amount columns of lit_record when
-- the caller may see amounts. An allow-list that follows the column grants: a column added
-- later with no grant for the app is never shown. (Definer: it reads the catalogue as the
-- owner, which sees every grant.)
CREATE FUNCTION lit_history_columns(tbl text, amounts boolean) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE((SELECT array_agg(DISTINCT c.column_name::text)
                   FROM information_schema.column_privileges c
                   WHERE c.grantee = 'lit_app' AND c.privilege_type = 'SELECT'
                     AND c.table_schema = 'public' AND c.table_name = tbl), '{}'::text[])
         || CASE WHEN amounts AND tbl = 'lit_record' THEN ARRAY['sum', 'hours', 'total'] ELSE '{}'::text[] END
$$;
REVOKE ALL ON FUNCTION lit_history_columns(text, boolean) FROM PUBLIC, lit_app, lit_gateway;

-- Was the record hidden when history row `row_id` was written? For rows that carry no
-- `hidden` of their own (project links, and Phase 4's file links). The state is
--   1. data.hidden of the latest lit_record row before it; or, with none (the owner made the
--      record, so nothing was captured),
--   2. inferred from the first later row that changed `hidden`: it set hidden to false, so
--      the record was hidden until then (and the reverse); or, with none,
--   3. the record's current `hidden` (the last captured state if the record is gone).
-- REDACT rows hold no snapshot and are skipped.
CREATE FUNCTION lit_history_hidden_at(record_id text, row_id bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT (h.data ->> 'hidden')::boolean FROM public.lit_history h
      WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id
        AND h.action <> 'REDACT' AND h.id < row_id
      ORDER BY h.id DESC LIMIT 1),
    (SELECT NOT (h.data ->> 'hidden')::boolean FROM public.lit_history h
      WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id
        AND h.action = 'UPDATE' AND 'hidden' = ANY(h.changed) AND h.id > row_id
      ORDER BY h.id LIMIT 1),
    (SELECT r.hidden FROM public.lit_record r WHERE r.id = record_id),
    (SELECT (h.data ->> 'hidden')::boolean FROM public.lit_history h
      WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id
        AND h.action = 'DELETE' ORDER BY h.id DESC LIMIT 1),
    false)
$$;
REVOKE ALL ON FUNCTION lit_history_hidden_at(text, bigint) FROM PUBLIC, lit_app, lit_gateway;

-- One record's history, newest first, paged (before_id = cursor), only while the caller can
-- read the record now. Non-admins see only the columns they may read, never a project link
-- whose project they cannot read, no redaction notice, nothing from the period the record was hidden, and
-- nothing that would show a masked value changed.
CREATE FUNCTION lit_record_history(record_id text, before_id bigint DEFAULT NULL, max_rows int DEFAULT 50)
RETURNS TABLE (id bigint, "createdAt" timestamptz, "tableName" text, action "HistoryAction",
               data jsonb, changed text[], "actorId" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp SET jit = off AS $$
  WITH ok AS (
    SELECT public.lit_current_user_is_admin() AS adm,
           record_id IN (SELECT public.lit_record_ids('read')) AS can_read,
           record_id IN (SELECT public.lit_record_ids('amounts')) AS amounts
  ),
  cols AS (
    SELECT t AS tbl, public.lit_history_columns(t, ok.amounts) AS allowed
    FROM ok, unnest(ARRAY['lit_record', 'lit_project_record']) t
  )
  SELECT p.id, p."createdAt", p."tableName", p.action, p.d, p.c, p."actorId"
  FROM (
    SELECT h.id, h."createdAt", h."tableName", h.action, h."actorId",
           CASE WHEN ok.adm THEN h.data
                ELSE (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                      FROM jsonb_each(h.data) e WHERE e.key = ANY(cols.allowed)) END AS d,
           CASE WHEN ok.adm OR h.changed IS NULL THEN h.changed
                ELSE ARRAY(SELECT k FROM unnest(h.changed) k WHERE k = ANY(cols.allowed)) END AS c
    FROM public.lit_history h
    JOIN ok ON true
    JOIN cols ON cols.tbl = h."tableName"
    WHERE h."entityId" = record_id
      AND public.lit_current_user_id() IS NOT NULL
      AND (ok.adm OR ok.can_read)
      AND (before_id IS NULL OR h.id < before_id)
      AND (ok.adm OR h.action <> 'REDACT')
      -- the hidden period: rows where the record is hidden (data) or was hidden or un-hidden
      -- (changed) are the admin's alone, so nobody learns what was done while it was hidden
      AND (ok.adm OR h."tableName" <> 'lit_record'
           OR NOT (COALESCE((h.data ->> 'hidden')::boolean, false)
                   OR COALESCE('hidden' = ANY(h.changed), false)))
      AND (ok.adm OR h."tableName" <> 'lit_project_record'
           OR (h.data ->> 'projectId' IN (SELECT public.lit_project_ids('read'))
               -- a link written while the record was hidden is part of the hidden period
               AND NOT public.lit_history_hidden_at(h."entityId", h.id)))
  ) p
  -- an update whose visible part did not change (e.g. only a masked amount) is not shown:
  -- it would reveal that, when and by whom a hidden value changed
  WHERE p.action <> 'UPDATE' OR cardinality(p.c) > 0
  ORDER BY p.id DESC
  LIMIT LEAST(GREATEST(COALESCE(max_rows, 50), 1), 200)
$$;
REVOKE ALL ON FUNCTION lit_record_history(text, bigint, int) FROM PUBLIC, lit_gateway;
GRANT EXECUTE ON FUNCTION lit_record_history(text, bigint, int) TO lit_app;

-- ===== Record ids are forever =====
-- An id that has history cannot be taken by a new record: the creator of a record may read
-- its whole history, so a user inserting a deleted record's id would read its past. Only app
-- writes (a signed-in actor) are refused. The owner path (seeds, restores) is not
-- captured and not guarded; seeds never write lit_history, so reloading them is unaffected.
CREATE FUNCTION lit_guard_record_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF public.lit_current_user_id() IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.lit_history h
       -- every table keyed by the record id: an owner-deleted record may have only link rows
       WHERE h."tableName" IN ('lit_record', 'lit_project_record', 'lit_record_file')
         AND h."entityId" = NEW.id) THEN
    RAISE EXCEPTION 'lit_record: id % already has history and cannot be reused', NEW.id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lit_guard_record_insert() FROM PUBLIC, lit_app, lit_gateway;
CREATE TRIGGER lit_guard_record_insert BEFORE INSERT ON lit_record
  FOR EACH ROW EXECUTE FUNCTION lit_guard_record_insert();

-- History is keyed by record id with no foreign key (it must outlive the record), so an id
-- change would orphan it. Nothing in the app renames a record; refuse it for everybody.
CREATE FUNCTION lit_guard_record_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'lit_record.id cannot be changed' USING ERRCODE = 'integrity_constraint_violation';
END $$;
REVOKE ALL ON FUNCTION lit_guard_record_id() FROM PUBLIC, lit_app, lit_gateway;
CREATE TRIGGER lit_guard_record_id BEFORE UPDATE ON lit_record
  FOR EACH ROW WHEN (OLD.id IS DISTINCT FROM NEW.id) EXECUTE FUNCTION lit_guard_record_id();

-- ===== Redaction =====
-- Deleting a record is not erasure: its history stays. When a value must go (a password
-- pasted into a note, personal data), an admin redacts the fields: they become JSON null in
-- every snapshot of the record, and one REDACT row records who did it and which fields.
-- `changed` is never touched, so the history still shows THAT a field changed, not to what.
-- Not redactable: id (the key of the history) and hidden (the reader's hidden-period rule).
CREATE FUNCTION lit_history_redact(record_id text, fields text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  admin_id text := public.lit_current_user_id();
  fs text[];
BEGIN
  IF admin_id IS NULL OR NOT public.lit_current_user_is_admin() THEN
    RAISE EXCEPTION 'lit_history_redact: admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF fields IS NULL OR cardinality(fields) = 0 OR array_position(fields, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'lit_history_redact: no fields given' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lit_history h
                 WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id) THEN
    RAISE EXCEPTION 'lit_history_redact: no history for record %', record_id
      USING ERRCODE = 'no_data_found';
  END IF;
  SELECT array_agg(DISTINCT f ORDER BY f) INTO fs FROM unnest(fields) f;
  IF 'id' = ANY(fs) OR 'hidden' = ANY(fs) THEN
    RAISE EXCEPTION 'lit_history_redact: id and hidden cannot be redacted'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(fs) f
             WHERE f NOT IN (SELECT a.attname::text FROM pg_catalog.pg_attribute a
                             WHERE a.attrelid = 'public.lit_record'::regclass
                               AND a.attnum > 0 AND NOT a.attisdropped)) THEN
    RAISE EXCEPTION 'lit_history_redact: not a lit_record column' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.lit_history h
  SET data = h.data || (SELECT jsonb_object_agg(f, 'null'::jsonb) FROM unnest(fs) f)
  WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id AND h.action <> 'REDACT';
  INSERT INTO public.lit_history ("tableName", "entityId", action, data, changed, "actorId")
  VALUES ('lit_record', record_id, 'REDACT', jsonb_build_object('fields', to_jsonb(fs)), fs, admin_id);
END $$;
REVOKE ALL ON FUNCTION lit_history_redact(text, text[]) FROM PUBLIC, lit_gateway;
GRANT EXECUTE ON FUNCTION lit_history_redact(text, text[]) TO lit_app;
