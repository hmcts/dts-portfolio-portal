import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  approveSubmission,
  createSubmission,
} from "@/lib/audit-log/submission";
import {
  getSubmissionById,
  listPendingSubmissions,
} from "@/lib/audit-log/queries";

// Integration tests for the approval flow's data layer: the queries
// the UI reads and the audit-log mutations the action wraps. The
// server action itself reaches for `next/headers` which is only
// available in request context, so the action is tested via e2e.

async function truncate() {
  await db.$executeRawUnsafe('TRUNCATE TABLE "Submission" RESTART IDENTITY');
}

beforeEach(truncate);
afterAll(async () => {
  await truncate();
  await db.$disconnect();
});

const SOURCE = Buffer.from(`---
type: team
name: Approval Test Team
domain: common-platform
---

# About

Test fixture.
`);

describe("listPendingSubmissions", () => {
  it("returns submissions ordered by submittedAt desc", async () => {
    const first = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SOURCE,
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await createSubmission({
      entityKind: "product",
      submitter: "bob@justice.gov.uk",
      sourceMarkdown: SOURCE,
    });

    const pending = await listPendingSubmissions();
    expect(pending.length).toBe(2);
    expect(pending[0]!.id).toBe(second.id);
    expect(pending[1]!.id).toBe(first.id);
  });

  it("excludes already-approved submissions", async () => {
    const a = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SOURCE,
    });
    const b = await createSubmission({
      entityKind: "product",
      submitter: "bob@justice.gov.uk",
      sourceMarkdown: SOURCE,
    });

    await approveSubmission({
      submissionId: a.id,
      approver: "carol@justice.gov.uk",
      versionNumber: 1,
    });

    const pending = await listPendingSubmissions();
    expect(pending.length).toBe(1);
    expect(pending[0]!.id).toBe(b.id);
  });
});

describe("getSubmissionById", () => {
  it("returns the submission with the source bytes preserved verbatim", async () => {
    const { id } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SOURCE,
    });

    const row = await getSubmissionById(id);
    expect(row).not.toBeNull();
    expect(Buffer.from(row!.sourceMarkdown).toString("utf8")).toBe(
      SOURCE.toString("utf8"),
    );
    expect(row!.approver).toBeNull();
    expect(row!.approvedAt).toBeNull();
  });

  it("returns null for an unknown id", async () => {
    expect(await getSubmissionById("does-not-exist")).toBeNull();
  });
});

describe("approveSubmission lifecycle", () => {
  it("stamps the approval columns and they show on subsequent reads", async () => {
    const { id } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SOURCE,
    });

    await approveSubmission({
      submissionId: id,
      approver: "bob@justice.gov.uk",
      versionNumber: 1,
      notes: "Reviewed against the source",
    });

    const row = await getSubmissionById(id);
    expect(row!.approver).toBe("bob@justice.gov.uk");
    expect(row!.approvedAt).toBeInstanceOf(Date);
    expect(row!.versionNumber).toBe(1);
    expect(row!.notes).toBe("Reviewed against the source");
  });

  it("rejects an attempt to change the submitter via approve (the DB trigger fires)", async () => {
    const { id } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SOURCE,
    });

    // The audit-log helper only exposes the safe-update fields, but
    // a future regression could try to widen the helper. The DB
    // trigger is the backstop.
    await expect(
      db.submission.update({
        where: { id },
        data: {
          approver: "carol@justice.gov.uk",
          submitter: "imposter@example.com",
        },
      }),
    ).rejects.toThrow(/append-only/i);
  });
});
