-- Append-only enforcement for the audit log per requirements spec §7.6.
--
-- The Submission table records every markdown upload + AI parse +
-- approval event. UPDATE and DELETE are constrained at the database
-- layer so application bugs cannot corrupt history.
--
-- Two triggers:
--
-- 1. submission_immutability_check (BEFORE UPDATE)
--    Raises if any column other than the approval-time columns
--    changes. The approver workflow legitimately sets approver,
--    approvedAt, versionNumber, notes, aiParsedOutput,
--    aiConfidenceFlags — anything else is rejected.
--
-- 2. submission_no_delete_check (BEFORE DELETE)
--    Raises on any row delete. Defence-in-depth: the app role should
--    also lack DELETE on Submission at provisioning time (infra-repo
--    concern), but this trigger guarantees the invariant even if the
--    grants drift.
--
-- TRUNCATE is intentionally NOT blocked at the trigger layer (BEFORE
-- DELETE triggers don't fire on TRUNCATE per Postgres semantics).
-- The app role should lack TRUNCATE privilege; tests run as a role
-- that has it so the test suite can clean state between cases.

CREATE OR REPLACE FUNCTION submission_immutability_guard()
RETURNS trigger AS $$
BEGIN
  IF (
       NEW."entityKind"        IS DISTINCT FROM OLD."entityKind"
    OR NEW."entityId"          IS DISTINCT FROM OLD."entityId"
    OR NEW."submitter"         IS DISTINCT FROM OLD."submitter"
    OR NEW."submittedAt"       IS DISTINCT FROM OLD."submittedAt"
    OR NEW."sourceMarkdown"    IS DISTINCT FROM OLD."sourceMarkdown"
    OR NEW."sourceMarkdownSha" IS DISTINCT FROM OLD."sourceMarkdownSha"
  ) THEN
    RAISE EXCEPTION 'Submission row is append-only; only approver, approvedAt, versionNumber, notes, aiParsedOutput, and aiConfidenceFlags may be updated.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER submission_immutability_check
BEFORE UPDATE ON "Submission"
FOR EACH ROW
EXECUTE FUNCTION submission_immutability_guard();

CREATE OR REPLACE FUNCTION submission_no_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Submission rows cannot be deleted (append-only audit log).'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER submission_no_delete_check
BEFORE DELETE ON "Submission"
FOR EACH ROW
EXECUTE FUNCTION submission_no_delete();
