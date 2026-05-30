-- AiParseMetric — per-parse token/latency record for the AI cost
-- monitoring dashboard (Phase 2 task 2.13). Append-only, same as
-- the Submission audit log; UPDATE + DELETE are revoked at the DB
-- layer with a trigger.

CREATE TABLE "AiParseMetric" (
  "id"               TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source"           TEXT NOT NULL,
  "model"            TEXT,
  "outcome"          TEXT NOT NULL,
  "promptTokens"     INTEGER,
  "completionTokens" INTEGER,
  "totalTokens"      INTEGER,
  "latencyMs"        INTEGER NOT NULL,
  "failureReason"    TEXT,
  "submissionId"     TEXT,
  CONSTRAINT "AiParseMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiParseMetric_createdAt_idx" ON "AiParseMetric"("createdAt");
CREATE INDEX "AiParseMetric_source_outcome_idx" ON "AiParseMetric"("source", "outcome");

-- Append-only enforcement. The trigger blocks both UPDATE and DELETE
-- so a metric, once written, is immutable. TRUNCATE is permitted so
-- test setup/teardown can reset the table.
CREATE OR REPLACE FUNCTION reject_ai_parse_metric_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AiParseMetric is append-only; % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER ai_parse_metric_no_update
  BEFORE UPDATE ON "AiParseMetric"
  FOR EACH ROW EXECUTE FUNCTION reject_ai_parse_metric_mutation();

CREATE TRIGGER ai_parse_metric_no_delete
  BEFORE DELETE ON "AiParseMetric"
  FOR EACH ROW EXECUTE FUNCTION reject_ai_parse_metric_mutation();
