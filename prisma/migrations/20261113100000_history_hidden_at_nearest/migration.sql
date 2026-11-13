-- lit_history_hidden_at: with no earlier record row, read the state from the NEAREST later
-- record row, not from the first later row that changed `hidden`.
--
-- An update that leaves `hidden` alone, or a delete, shows the state just before it as its own
-- data.hidden; one that changed `hidden` shows the opposite. The old rule skipped the former and
-- went on to the first change of `hidden`, which an untraced owner write may have made stale:
-- owner hides a record, admin links it, admin edits it (row says hidden), owner un-hides,
-- admin hides again (row says it changed hidden to true). The old rule inferred "visible" at the
-- link and showed a hidden-period link to non-admins; the nearest row says hidden.
-- The later DELETE row is covered by the same rule, so the separate DELETE fallback goes.
CREATE OR REPLACE FUNCTION lit_history_hidden_at(record_id text, row_id bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(
    -- 1. the latest earlier record row
    (SELECT (h.data ->> 'hidden')::boolean FROM public.lit_history h
      WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id
        AND h.action <> 'REDACT' AND h.id < row_id
      ORDER BY h.id DESC LIMIT 1),
    -- 2. the first later update or delete: the state just before it
    (SELECT (h.data ->> 'hidden')::boolean <> COALESCE('hidden' = ANY(h.changed), false)
       FROM public.lit_history h
      WHERE h."tableName" = 'lit_record' AND h."entityId" = record_id
        AND h.action IN ('UPDATE', 'DELETE') AND h.id > row_id
      ORDER BY h.id LIMIT 1),
    -- 3. the record's current state
    (SELECT r.hidden FROM public.lit_record r WHERE r.id = record_id),
    false)
$$;
