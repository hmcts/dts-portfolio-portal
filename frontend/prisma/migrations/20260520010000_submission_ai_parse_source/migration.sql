-- Add `aiParseSource` to the Submission audit log per Phase 2 task 2.14.
--
-- Records which parser produced the persisted `aiParsedOutput` —
-- one of "azure-openai", "strict-template", or "stub" (test-only).
-- Surfaces on the approval screen so reviewers can tell at a glance
-- whether they're looking at AOAI output or the strict-template
-- fallback that runs when AOAI is unavailable (spec §7.5).
--
-- Nullable: pre-existing rows keep NULL until they're re-parsed.
-- The approval screen renders a neutral "unknown" pill when the
-- column is null.
--
-- The append-only trigger added in 20260519200000_submission_append_only
-- guards a fixed list of immutable columns (entityKind, entityId,
-- submitter, submittedAt, sourceMarkdown, sourceMarkdownSha). This
-- new column is NOT in that list, so the trigger doesn't need to
-- change — the column is settable at INSERT and on update.

ALTER TABLE "Submission" ADD COLUMN "aiParseSource" TEXT;
