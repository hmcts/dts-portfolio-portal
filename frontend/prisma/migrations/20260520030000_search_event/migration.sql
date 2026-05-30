-- SearchEvent — one row per /api/search hit ("query") plus one row
-- per result click ("click"). Powers the /ops/search relevance
-- dashboard (Phase 3 task 3.7). Append-only at the DB layer.

CREATE TABLE "SearchEvent" (
  "id"                TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind"              TEXT NOT NULL,
  "query"             TEXT NOT NULL,
  "resultCount"       INTEGER,
  "clickedEntityType" TEXT,
  "clickedEntityId"   TEXT,
  "clickedPosition"   INTEGER,
  "subjectHash"       TEXT,
  CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchEvent_createdAt_idx"      ON "SearchEvent"("createdAt");
CREATE INDEX "SearchEvent_kind_createdAt_idx" ON "SearchEvent"("kind", "createdAt");
CREATE INDEX "SearchEvent_query_idx"          ON "SearchEvent"("query");

-- Append-only enforcement: same pattern as Submission + AiParseMetric.
CREATE OR REPLACE FUNCTION reject_search_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'SearchEvent is append-only; % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER search_event_no_update
  BEFORE UPDATE ON "SearchEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_search_event_mutation();

CREATE TRIGGER search_event_no_delete
  BEFORE DELETE ON "SearchEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_search_event_mutation();
