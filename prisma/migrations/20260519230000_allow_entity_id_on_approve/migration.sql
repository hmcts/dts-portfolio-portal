-- Loosen the Submission immutability trigger to allow entityId to be
-- set at approve time. The original trigger (migration
-- 20260519200000_submission_append_only) treated entityId as immutable
-- once inserted, but for new entities the entityId can't be known at
-- INSERT — it's the primary key of the row this Submission publishes
-- into, which is created at approve time.
--
-- Approver workflow can now update: approver, approvedAt, versionNumber,
-- notes, aiParsedOutput, aiConfidenceFlags, AND entityId. Everything
-- else (entityKind, submitter, submittedAt, sourceMarkdown,
-- sourceMarkdownSha) stays immutable.

CREATE OR REPLACE FUNCTION submission_immutability_guard()
RETURNS trigger AS $$
BEGIN
  IF (
       NEW."entityKind"        IS DISTINCT FROM OLD."entityKind"
    OR NEW."submitter"         IS DISTINCT FROM OLD."submitter"
    OR NEW."submittedAt"       IS DISTINCT FROM OLD."submittedAt"
    OR NEW."sourceMarkdown"    IS DISTINCT FROM OLD."sourceMarkdown"
    OR NEW."sourceMarkdownSha" IS DISTINCT FROM OLD."sourceMarkdownSha"
  ) THEN
    RAISE EXCEPTION 'Submission row is append-only; only approver, approvedAt, versionNumber, notes, aiParsedOutput, aiConfidenceFlags, and entityId may be updated.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
