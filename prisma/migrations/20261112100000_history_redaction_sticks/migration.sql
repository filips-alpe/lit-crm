-- Redaction sticks. lit_history_redact nulled a field in the snapshots that existed, but the
-- live record still held the value, so the next save (which snapshots the whole row) wrote it
-- back. Now the redaction keeps a SHA-256 digest of every redacted value, and the capture
-- trigger nulls a field whose value matches one. New values of the field are recorded as usual.

CREATE TABLE "lit_history_redaction" (
  "entityId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "digest" BYTEA NOT NULL,
  CONSTRAINT "lit_history_redaction_pkey" PRIMARY KEY ("entityId", "field", "digest")
);
-- Closed like lit_history: only the definer functions below read or write it.
ALTER TABLE lit_history_redaction ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lit_history_redaction FROM PUBLIC, lit_app, lit_gateway;

-- The digest of a JSON value as to_jsonb renders it, so a live value and a snapshot compare equal.
CREATE FUNCTION lit_history_digest(v jsonb) RETURNS bytea
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT pg_catalog.sha256(pg_catalog.convert_to(v::text, 'UTF8'))
$$;
REVOKE ALL ON FUNCTION lit_history_digest(jsonb) FROM PUBLIC, lit_app, lit_gateway;

CREATE OR REPLACE FUNCTION lit_capture_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  actor text := public.lit_current_user_id();
  o jsonb;
  n jsonb;
  d jsonb;
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
  d := COALESCE(n, o);
  -- a redacted value never re-enters history ('changed' still says the field changed)
  IF TG_TABLE_NAME = 'lit_record' THEN
    SELECT d || COALESCE(jsonb_object_agg(r.field, 'null'::jsonb), '{}'::jsonb) INTO d
    FROM public.lit_history_redaction r
    WHERE r."entityId" = d ->> 'id' AND d ? r.field
      AND r.digest = public.lit_history_digest(d -> r.field);
  END IF;
  INSERT INTO public.lit_history ("tableName", "entityId", action, data, changed, "actorId")
  VALUES (TG_TABLE_NAME, d ->> COALESCE(TG_ARGV[0], 'id'), TG_OP::"HistoryAction", d, ch, actor);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION lit_history_redact(record_id text, fields text[]) RETURNS void
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
  -- remember every value being redacted: those in the snapshots and the live one (an owner
  -- write may have put a value in the record that history never held)
  INSERT INTO public.lit_history_redaction ("entityId", field, digest)
  SELECT DISTINCT record_id, x.f, public.lit_history_digest(x.v)
  FROM (
    SELECT f, h.data -> f AS v
    FROM public.lit_history h, unnest(fs) f
    WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id AND h.action <> 'REDACT'
    UNION ALL
    SELECT f, to_jsonb(r) -> f
    FROM public.lit_record r, unnest(fs) f
    WHERE r.id = record_id
  ) x
  WHERE x.v IS NOT NULL AND x.v <> 'null'::jsonb
  ON CONFLICT DO NOTHING;
  UPDATE public.lit_history h
  SET data = h.data || (SELECT jsonb_object_agg(f, 'null'::jsonb) FROM unnest(fs) f)
  WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id AND h.action <> 'REDACT';
  INSERT INTO public.lit_history ("tableName", "entityId", action, data, changed, "actorId")
  VALUES ('lit_record', record_id, 'REDACT', jsonb_build_object('fields', to_jsonb(fs)), fs, admin_id);
END $$;
