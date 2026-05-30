import { db } from "@/lib/db";
import { looksLikeSlug, normaliseJurisdictionRef, slugify } from "./slugify";
import type { TimeBucket } from "@/lib/entities";

// Publish a submission's parsed output to the live entity tables per
// spec §7.4 + §4. Approve-and-publish is the only path that touches
// the entity tables; uploads land in the append-only Submission audit
// log first, the parsed content is reviewed, then this function
// upserts the entity by slug.
//
// Child collections (initiatives, outbound links, strategic themes)
// are REPLACED wholesale on every approve. The audit log preserves
// every prior version of the source markdown, so the per-field
// history concern is already addressed there (§7.6).

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

export interface PublishResult {
  entityKind: "jurisdiction" | "domain" | "team" | "product";
  entityId: string;
  entitySlug: string;
  entityName: string;
}

interface JurisdictionParse {
  type: "jurisdiction";
  name: string;
  about?: string;
}

interface DomainParse {
  type: "domain";
  name: string;
  jurisdiction: string;
  about?: string;
  themes: { title: string; description?: string }[];
}

interface TeamParse {
  type: "team";
  name: string;
  domain: string;
  about?: string;
  howToReachUs?: string;
}

interface ProductParse {
  type: "product";
  name: string;
  domain: string;
  team?: string;
  stage?: "discovery" | "alpha" | "beta" | "live" | "retiring" | "retired";
  about?: string;
  roadmap: Record<TimeBucket, { title: string; description?: string }[]>;
  links: { label: string; url: string }[];
}

type Parse = JurisdictionParse | DomainParse | TeamParse | ProductParse;

// Pull the persisted aiParsedOutput shape into a flat, narrowed
// per-type object so the publish helpers don't fight TypeScript
// narrowing across the front-matter/output split.
function asParse(raw: unknown): Parse {
  if (!raw || typeof raw !== "object") {
    throw new PublishError("aiParsedOutput is missing or not an object");
  }
  const obj = raw as {
    frontMatter?: { type?: string };
    output?: { kind?: string };
  };
  const fm = obj.frontMatter;
  const out = obj.output;
  if (!fm || !out || fm.type !== out.kind) {
    throw new PublishError(
      "aiParsedOutput must carry matching frontMatter.type and output.kind",
    );
  }
  switch (fm.type) {
    case "jurisdiction": {
      const x = obj as {
        frontMatter: { name: string };
        output: { about?: string };
      };
      return { type: "jurisdiction", name: x.frontMatter.name, about: x.output.about };
    }
    case "domain": {
      const x = obj as {
        frontMatter: { name: string; jurisdiction: string };
        output: {
          body?: {
            about?: string;
            strategicThemes?: { title: string; description?: string }[];
          };
        };
      };
      return {
        type: "domain",
        name: x.frontMatter.name,
        jurisdiction: x.frontMatter.jurisdiction,
        about: x.output.body?.about,
        themes: x.output.body?.strategicThemes ?? [],
      };
    }
    case "team": {
      const x = obj as {
        frontMatter: { name: string; domain: string };
        output: {
          body?: { about?: string; howToReachUs?: string };
        };
      };
      return {
        type: "team",
        name: x.frontMatter.name,
        domain: x.frontMatter.domain,
        about: x.output.body?.about,
        howToReachUs: x.output.body?.howToReachUs,
      };
    }
    case "product": {
      const x = obj as {
        frontMatter: {
          name: string;
          domain: string;
          team?: string;
          stage?:
            | "discovery"
            | "alpha"
            | "beta"
            | "live"
            | "retiring"
            | "retired";
        };
        output: {
          body?: {
            about?: string;
            roadmap?: Record<
              TimeBucket,
              { title: string; description?: string }[]
            >;
            links?: { label: string; url: string }[];
          };
        };
      };
      return {
        type: "product",
        name: x.frontMatter.name,
        domain: x.frontMatter.domain,
        team: x.frontMatter.team,
        stage: x.frontMatter.stage,
        about: x.output.body?.about,
        roadmap: x.output.body?.roadmap ?? { NOW: [], NEXT: [], LATER: [] },
        links: x.output.body?.links ?? [],
      };
    }
    default:
      throw new PublishError(`Unknown entity type "${fm.type}"`);
  }
}

async function resolveDomainRef(ref: string) {
  const lower = ref.trim().toLowerCase();
  const domain =
    (await db.productDomain.findUnique({ where: { slug: lower } })) ??
    (await db.productDomain.findFirst({
      where: { name: { equals: ref, mode: "insensitive" } },
    }));
  if (!domain) {
    throw new PublishError(
      `Parent Domain "${ref}" does not exist yet. Approve the Domain first, then re-approve this submission.`,
    );
  }
  return domain;
}

async function resolveTeamRef(ref: string, domainId: string) {
  const lower = ref.trim().toLowerCase();
  const team =
    (await db.team.findUnique({ where: { slug: lower } })) ??
    (await db.team.findFirst({
      where: { name: { equals: ref, mode: "insensitive" } },
    }));
  if (!team) {
    throw new PublishError(
      `Operating Team "${ref}" does not exist yet. Approve the Team first, then re-approve this submission.`,
    );
  }
  if (team.domainId !== domainId) {
    throw new PublishError(
      `Operating Team "${ref}" belongs to a different Domain than the one this Product references. Per spec §4.1 the operating Team must live in the strategic Domain.`,
    );
  }
  return team;
}

function deriveSlug(name: string): string {
  return looksLikeSlug(name) ? name : slugify(name);
}

async function publishJurisdiction(p: JurisdictionParse): Promise<PublishResult> {
  const slug = normaliseJurisdictionRef(p.name);
  if (!slug) {
    throw new PublishError(
      `Jurisdiction name "${p.name}" is not in the fixed v1 taxonomy (Crime / Civil / Family / Tribunals / Administrative). Per spec §3.2 Jurisdictions are configuration, not approvable content.`,
    );
  }
  const entity = await db.jurisdiction.upsert({
    where: { slug },
    update: { name: p.name, description: p.about ?? null },
    create: { slug, name: p.name, description: p.about ?? null },
  });
  return {
    entityKind: "jurisdiction",
    entityId: entity.id,
    entitySlug: entity.slug,
    entityName: entity.name,
  };
}

async function publishDomain(p: DomainParse): Promise<PublishResult> {
  const jurisdictionSlug = normaliseJurisdictionRef(p.jurisdiction);
  if (!jurisdictionSlug) {
    throw new PublishError(
      `Parent Jurisdiction "${p.jurisdiction}" is not in the fixed taxonomy.`,
    );
  }
  const jurisdiction = await db.jurisdiction.upsert({
    where: { slug: jurisdictionSlug },
    update: {},
    create: {
      slug: jurisdictionSlug,
      name: jurisdictionSlug[0].toUpperCase() + jurisdictionSlug.slice(1),
    },
  });
  const slug = deriveSlug(p.name);
  const entity = await db.$transaction(async (tx) => {
    const existing = await tx.productDomain.findUnique({ where: { slug } });
    const domain = await tx.productDomain.upsert({
      where: { slug },
      update: {
        name: p.name,
        description: p.about ?? null,
        jurisdictionId: jurisdiction.id,
      },
      create: {
        slug,
        name: p.name,
        description: p.about ?? null,
        jurisdictionId: jurisdiction.id,
      },
    });
    if (existing) {
      await tx.theme.deleteMany({ where: { domainId: domain.id } });
    }
    if (p.themes.length > 0) {
      await tx.theme.createMany({
        data: p.themes.map((t, i) => ({
          domainId: domain.id,
          title: t.title,
          description: t.description ?? null,
          position: i,
        })),
      });
    }
    return domain;
  });
  return {
    entityKind: "domain",
    entityId: entity.id,
    entitySlug: entity.slug,
    entityName: entity.name,
  };
}

async function publishTeam(p: TeamParse): Promise<PublishResult> {
  const domain = await resolveDomainRef(p.domain);
  const slug = deriveSlug(p.name);
  const team = await db.team.upsert({
    where: { slug },
    update: {
      name: p.name,
      description: p.about ?? null,
      contact: p.howToReachUs ?? null,
      domainId: domain.id,
    },
    create: {
      slug,
      name: p.name,
      description: p.about ?? null,
      contact: p.howToReachUs ?? null,
      domainId: domain.id,
    },
  });
  return {
    entityKind: "team",
    entityId: team.id,
    entitySlug: team.slug,
    entityName: team.name,
  };
}

async function publishProduct(p: ProductParse): Promise<PublishResult> {
  const domain = await resolveDomainRef(p.domain);
  if (!p.team) {
    throw new PublishError(
      "Product is missing an operating Team reference. Add `team: <slug-or-name>` to the front-matter. (Phase 2 simplification — the approver-picker UI lands in a follow-up.)",
    );
  }
  const team = await resolveTeamRef(p.team, domain.id);
  const slug = deriveSlug(p.name);
  const stage = p.stage ?? "live";

  const initiatives = (["NOW", "NEXT", "LATER"] as TimeBucket[]).flatMap(
    (bucket) =>
      p.roadmap[bucket].map((i) => ({
        bucket,
        title: i.title,
        description: i.description,
      })),
  );

  const product = await db.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { slug } });
    const upserted = await tx.product.upsert({
      where: { slug },
      update: {
        name: p.name,
        description: p.about ?? null,
        stage,
        domainId: domain.id,
        operatingTeamId: team.id,
      },
      create: {
        slug,
        name: p.name,
        description: p.about ?? null,
        stage,
        domainId: domain.id,
        operatingTeamId: team.id,
      },
    });
    if (existing) {
      await tx.initiative.deleteMany({ where: { productId: upserted.id } });
      await tx.outboundLink.deleteMany({ where: { productId: upserted.id } });
    }
    if (initiatives.length > 0) {
      await tx.initiative.createMany({
        data: initiatives.map((i, idx) => ({
          productId: upserted.id,
          bucket: i.bucket,
          title: i.title,
          description: i.description ?? null,
          position: idx,
        })),
      });
    }
    if (p.links.length > 0) {
      await tx.outboundLink.createMany({
        data: p.links.map((l, idx) => ({
          productId: upserted.id,
          label: l.label,
          url: l.url,
          position: idx,
        })),
      });
    }
    return upserted;
  });

  return {
    entityKind: "product",
    entityId: product.id,
    entitySlug: product.slug,
    entityName: product.name,
  };
}

export async function publishParsedSubmission(
  aiParsedOutput: unknown,
): Promise<PublishResult> {
  const p = asParse(aiParsedOutput);
  switch (p.type) {
    case "jurisdiction":
      return publishJurisdiction(p);
    case "domain":
      return publishDomain(p);
    case "team":
      return publishTeam(p);
    case "product":
      return publishProduct(p);
  }
}
