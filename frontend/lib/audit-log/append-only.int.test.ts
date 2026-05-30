import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  approveSubmission,
  createSubmission,
  hashSourceMarkdown,
} from "./submission";

// Integration tests proving the database-level append-only invariant
// from spec §7.6. These need a real Postgres with the
// `submission_append_only` migration applied — see vitest.int.config.ts.
//
// Each test inserts unique data and TRUNCATEs Submission afterwards.
// TRUNCATE bypasses the BEFORE DELETE trigger by Postgres design, so
// the test cleanup doesn't trip the no-delete rule. The app code path
// never runs TRUNCATE; the test role has that privilege but the app
// role at provisioning time should not.

const SAMPLE_MARKDOWN = Buffer.from(`---
type: team
name: Test Team
domain: common-platform
---

# About

Append-only test fixture.
`);

async function truncate() {
  await db.$executeRawUnsafe('TRUNCATE TABLE "Submission" RESTART IDENTITY');
}

beforeEach(truncate);

afterAll(async () => {
  await truncate();
  await db.$disconnect();
});

describe("Submission append-only invariant", () => {
  it("inserts a Submission with the SHA-256 of the source markdown", async () => {
    const { id, sourceMarkdownSha } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SAMPLE_MARKDOWN,
    });
    expect(id).toBeTruthy();
    expect(sourceMarkdownSha).toBe(hashSourceMarkdown(SAMPLE_MARKDOWN));

    const row = await db.submission.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row!.entityKind).toBe("team");
    expect(row!.submitter).toBe("alice@justice.gov.uk");
    expect(row!.approver).toBeNull();
    expect(row!.approvedAt).toBeNull();
  });

  it("allows UPDATE of approval-time columns only", async () => {
    const { id } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SAMPLE_MARKDOWN,
    });

    await approveSubmission({
      submissionId: id,
      approver: "bob@justice.gov.uk",
      versionNumber: 1,
      notes: "Looks fine",
    });

    const row = await db.submission.findUnique({ where: { id } });
    expect(row!.approver).toBe("bob@justice.gov.uk");
    expect(row!.approvedAt).toBeInstanceOf(Date);
    expect(row!.versionNumber).toBe(1);
    expect(row!.notes).toBe("Looks fine");
  });

  it("rejects UPDATE that changes the submitter", async () => {
    const { id } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SAMPLE_MARKDOWN,
    });

    await expect(
      db.submission.update({
        where: { id },
        data: { submitter: "imposter@example.com" },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it("rejects UPDATE that changes the source markdown bytes", async () => {
    const { id } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SAMPLE_MARKDOWN,
    });

    await expect(
      db.submission.update({
        where: { id },
        data: { sourceMarkdown: Buffer.from("# Tampered content") },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it("rejects UPDATE that changes the entityKind", async () => {
    const { id } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SAMPLE_MARKDOWN,
    });

    await expect(
      db.submission.update({
        where: { id },
        data: { entityKind: "product" },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it("rejects DELETE on a Submission row", async () => {
    const { id } = await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SAMPLE_MARKDOWN,
    });

    await expect(
      db.submission.delete({ where: { id } }),
    ).rejects.toThrow(/cannot be deleted/i);

    // Row is still there
    const stillThere = await db.submission.findUnique({ where: { id } });
    expect(stillThere).not.toBeNull();
  });

  it("rejects deleteMany the same way (defence-in-depth)", async () => {
    await createSubmission({
      entityKind: "team",
      submitter: "alice@justice.gov.uk",
      sourceMarkdown: SAMPLE_MARKDOWN,
    });

    await expect(
      db.submission.deleteMany({ where: {} }),
    ).rejects.toThrow(/cannot be deleted/i);
  });

  it("caches by sourceMarkdownSha for idempotent re-uploads (§7.5)", async () => {
    const sha = hashSourceMarkdown(SAMPLE_MARKDOWN);
    expect(sha).toHaveLength(64);

    // Same bytes → same hash (the parse cache key)
    const sha2 = hashSourceMarkdown(SAMPLE_MARKDOWN);
    expect(sha2).toBe(sha);

    // Different bytes → different hash
    const otherSha = hashSourceMarkdown(Buffer.from("anything else"));
    expect(otherSha).not.toBe(sha);
  });
});
