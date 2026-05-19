import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  PublishError,
  publishParsedSubmission,
  type PublishResult,
} from "./publish";

// Integration tests for the publish step that turns an approved
// Submission's parsed output into rows in the entity tables. Each
// test resets the entity tables and re-publishes a synthetic parse
// payload that matches what src/lib/upload/pipeline.ts persists.

async function truncateEntities() {
  // Order matters — children before parents per FK direction.
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "Initiative", "OutboundLink", "Theme", "Product", "Team", "ProductDomain", "Jurisdiction" RESTART IDENTITY CASCADE',
  );
}

beforeEach(truncateEntities);
afterAll(async () => {
  await truncateEntities();
  await db.$disconnect();
});

function jurisdictionPayload(name: string) {
  return {
    frontMatter: { type: "jurisdiction", name },
    output: { kind: "jurisdiction", about: `${name} description` },
  };
}

function domainPayload(name: string, jurisdiction: string) {
  return {
    frontMatter: { type: "domain", name, jurisdiction },
    output: {
      kind: "domain",
      body: {
        about: `${name} description`,
        strategicThemes: [
          { title: "Reduce sprawl", description: "consolidate services" },
          { title: "Faster sign-in" },
        ],
      },
    },
  };
}

function teamPayload(name: string, domain: string) {
  return {
    frontMatter: { type: "team", name, domain },
    output: {
      kind: "team",
      body: {
        about: `${name} runs things`,
        howToReachUs: "team@justice.gov.uk",
      },
    },
  };
}

function productPayload(
  name: string,
  domain: string,
  team: string,
  opts: { stage?: "live" | "beta"; nowChips?: string[] } = {},
) {
  return {
    frontMatter: {
      type: "product",
      name,
      domain,
      team,
      stage: opts.stage ?? "live",
    },
    output: {
      kind: "product",
      body: {
        about: `${name} platform`,
        roadmap: {
          NOW: (opts.nowChips ?? ["Initial chip"]).map((t) => ({ title: t })),
          NEXT: [],
          LATER: [],
        },
        links: [
          { label: "Confluence", url: "https://confluence.example/x" },
        ],
      },
    },
  };
}

describe("publishParsedSubmission — happy paths", () => {
  it("publishes a Jurisdiction into the fixed taxonomy", async () => {
    const result = await publishParsedSubmission(jurisdictionPayload("Crime"));
    expect(result.entityKind).toBe("jurisdiction");
    expect(result.entitySlug).toBe("crime");

    const row = await db.jurisdiction.findUnique({ where: { slug: "crime" } });
    expect(row?.name).toBe("Crime");
    expect(row?.description).toBe("Crime description");
  });

  it("rejects a Jurisdiction outside the fixed taxonomy", async () => {
    await expect(
      publishParsedSubmission(jurisdictionPayload("Outer Space")),
    ).rejects.toBeInstanceOf(PublishError);
  });

  it("publishes a Domain after its Jurisdiction exists, with themes", async () => {
    await publishParsedSubmission(jurisdictionPayload("Crime"));
    const result = await publishParsedSubmission(
      domainPayload("Common Platform Domain", "crime"),
    );
    expect(result.entityKind).toBe("domain");
    expect(result.entitySlug).toBe("common-platform-domain");

    const themes = await db.theme.findMany({
      where: { domain: { slug: result.entitySlug } },
    });
    expect(themes).toHaveLength(2);
    expect(themes.map((t) => t.title).sort()).toEqual([
      "Faster sign-in",
      "Reduce sprawl",
    ]);
  });

  it("auto-creates the parent Jurisdiction when a Domain is published before it", async () => {
    const result = await publishParsedSubmission(
      domainPayload("Civil Money Domain", "civil"),
    );
    expect(result.entitySlug).toBe("civil-money-domain");
    const j = await db.jurisdiction.findUnique({ where: { slug: "civil" } });
    expect(j).not.toBeNull();
  });

  it("rejects a Team whose parent Domain doesn't exist", async () => {
    await expect(
      publishParsedSubmission(teamPayload("Orphan Team", "missing-domain")),
    ).rejects.toBeInstanceOf(PublishError);
  });

  it("publishes a Team with contact info preserved from howToReachUs", async () => {
    await publishParsedSubmission(jurisdictionPayload("Crime"));
    await publishParsedSubmission(
      domainPayload("Common Platform Domain", "crime"),
    );
    const result = await publishParsedSubmission(
      teamPayload("Identity Team", "common-platform-domain"),
    );
    const team = await db.team.findUnique({ where: { slug: result.entitySlug } });
    expect(team?.contact).toBe("team@justice.gov.uk");
  });

  it("publishes a Product end-to-end with roadmap + links", async () => {
    await publishParsedSubmission(jurisdictionPayload("Crime"));
    await publishParsedSubmission(
      domainPayload("Common Platform Domain", "crime"),
    );
    await publishParsedSubmission(
      teamPayload("Identity Team", "common-platform-domain"),
    );
    const result = await publishParsedSubmission(
      productPayload(
        "Crime Sign In",
        "common-platform-domain",
        "identity-team",
        { stage: "live", nowChips: ["Passkeys pilot", "Latency cut"] },
      ),
    );
    expect(result.entityKind).toBe("product");
    expect(result.entitySlug).toBe("crime-sign-in");

    const product = await db.product.findUnique({
      where: { slug: result.entitySlug },
      include: { initiatives: true, outboundLinks: true },
    });
    expect(product?.stage).toBe("live");
    expect(product?.initiatives).toHaveLength(2);
    expect(product?.outboundLinks).toHaveLength(1);
  });

  it("rejects a Product whose operating Team is missing from front-matter", async () => {
    await publishParsedSubmission(jurisdictionPayload("Crime"));
    await publishParsedSubmission(
      domainPayload("Common Platform Domain", "crime"),
    );
    const payload = productPayload("X", "common-platform-domain", "x") as {
      frontMatter: { team?: string };
    };
    delete payload.frontMatter.team;
    await expect(
      publishParsedSubmission(payload as unknown as object),
    ).rejects.toBeInstanceOf(PublishError);
  });

  it("rejects a Product whose Team belongs to a different Domain", async () => {
    await publishParsedSubmission(jurisdictionPayload("Crime"));
    await publishParsedSubmission(
      domainPayload("Domain A", "crime"),
    );
    await publishParsedSubmission(
      domainPayload("Domain B", "crime"),
    );
    await publishParsedSubmission(teamPayload("Team A", "domain-a"));
    // Try to publish a Product in Domain B that references Team A
    await expect(
      publishParsedSubmission(
        productPayload("Mixed Product", "domain-b", "team-a"),
      ),
    ).rejects.toBeInstanceOf(PublishError);
  });
});

describe("publishParsedSubmission — re-publish replaces child collections", () => {
  it("REPLACES initiatives on re-publish (no duplicates)", async () => {
    await publishParsedSubmission(jurisdictionPayload("Crime"));
    await publishParsedSubmission(
      domainPayload("Common Platform Domain", "crime"),
    );
    await publishParsedSubmission(
      teamPayload("Identity Team", "common-platform-domain"),
    );

    await publishParsedSubmission(
      productPayload(
        "Sign In",
        "common-platform-domain",
        "identity-team",
        { nowChips: ["Chip A", "Chip B"] },
      ),
    );
    let count = await db.initiative.count();
    expect(count).toBe(2);

    // Re-publish with only one chip
    const r = await publishParsedSubmission(
      productPayload(
        "Sign In",
        "common-platform-domain",
        "identity-team",
        { nowChips: ["Chip C"] },
      ),
    );
    count = await db.initiative.count();
    expect(count).toBe(1);
    const remaining = await db.initiative.findMany({
      where: { productId: r.entityId },
    });
    expect(remaining[0]!.title).toBe("Chip C");
  });

  it("REPLACES themes on re-publish", async () => {
    await publishParsedSubmission(jurisdictionPayload("Crime"));
    await publishParsedSubmission(
      domainPayload("Common Platform Domain", "crime"),
    );
    expect(await db.theme.count()).toBe(2);

    const r = await publishParsedSubmission({
      frontMatter: { type: "domain", name: "Common Platform Domain", jurisdiction: "crime" },
      output: {
        kind: "domain",
        body: {
          about: "Updated description",
          strategicThemes: [{ title: "Only this theme remains" }],
        },
      },
    } as unknown as object);
    expect(r.entityKind).toBe("domain");
    expect(await db.theme.count()).toBe(1);
  });
});

describe("publishParsedSubmission — guards against malformed payloads", () => {
  it("rejects a null payload", async () => {
    await expect(
      publishParsedSubmission(null),
    ).rejects.toBeInstanceOf(PublishError);
  });

  it("rejects mismatched frontMatter.type vs output.kind", async () => {
    await expect(
      publishParsedSubmission({
        frontMatter: { type: "team", name: "x", domain: "common-platform" },
        output: { kind: "product", body: {} },
      } as unknown as object),
    ).rejects.toBeInstanceOf(PublishError);
  });
});

// Sanity assertion on the PublishResult shape so future helpers can
// safely consume it.
function assertPublishResult(r: PublishResult): void {
  expect(typeof r.entityId).toBe("string");
  expect(typeof r.entitySlug).toBe("string");
  expect(typeof r.entityName).toBe("string");
}

describe("PublishResult shape", () => {
  it("returns the expected fields on jurisdiction publish", async () => {
    const r = await publishParsedSubmission(jurisdictionPayload("Crime"));
    assertPublishResult(r);
  });
});
