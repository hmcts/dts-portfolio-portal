import { db } from "./db";
import { portalContent } from "./seed";
import type { PortalContent } from "./entities";

// Seed-loader for Phase 2 task 2.11 — bootstraps the entity tables
// from the in-memory seed shape (src/lib/seed.ts) so the portal
// can be demo'd end-to-end against a real Postgres without
// hand-authoring + approving 75 markdown files first.
//
// Idempotency: every upsert keys on the natural slug for entities
// that have one (Jurisdiction / ProductDomain / Team / Product),
// so running the loader twice converges on the same DB state.
// Initiatives + Themes + OutboundLinks are CHILD COLLECTIONS and
// get the same REPLACE-on-publish treatment as publishParsedSubmission
// uses: drop everything under each parent, re-insert from the seed.
//
// The seed module remains the source of truth for the bootstrap
// content during Phase 2. Phase 2 task 2.11's follow-up swaps the
// page read path from seed → DB; this loader is the bridge.

export interface SeedLoadResult {
  jurisdictions: number;
  domains: number;
  themes: number;
  teams: number;
  products: number;
  initiatives: number;
  outboundLinks: number;
}

export async function loadSeedIntoDb(
  content: PortalContent = portalContent,
): Promise<SeedLoadResult> {
  // ----- Jurisdictions -----
  for (const j of content.jurisdictions) {
    await db.jurisdiction.upsert({
      where: { slug: j.slug },
      update: { name: j.name, description: j.description ?? null },
      create: { slug: j.slug, name: j.name, description: j.description ?? null },
    });
  }

  // Slug → id maps so we can resolve relations as we go.
  const jurisdictionIdBySlug = new Map(
    (await db.jurisdiction.findMany({ select: { id: true, slug: true } })).map(
      (j) => [j.slug, j.id],
    ),
  );

  // ----- ProductDomains + their strategic themes -----
  let themesCount = 0;
  for (const d of content.domains) {
    const jurisdictionId = jurisdictionIdBySlug.get(d.jurisdictionSlug);
    if (!jurisdictionId) {
      throw new Error(
        `Seed Domain '${d.slug}' references unknown jurisdiction '${d.jurisdictionSlug}'`,
      );
    }
    const domain = await db.productDomain.upsert({
      where: { slug: d.slug },
      update: {
        name: d.name,
        description: d.description ?? null,
        jurisdictionId,
      },
      create: {
        slug: d.slug,
        name: d.name,
        description: d.description ?? null,
        jurisdictionId,
      },
    });
    // Themes: REPLACE on every re-seed so the seed shape always wins.
    await db.theme.deleteMany({ where: { domainId: domain.id } });
    for (let i = 0; i < d.strategicThemes.length; i++) {
      const t = d.strategicThemes[i]!;
      await db.theme.create({
        data: {
          domainId: domain.id,
          title: t.title,
          description: t.description ?? null,
          position: i,
        },
      });
      themesCount += 1;
    }
  }

  const domainIdBySlug = new Map(
    (await db.productDomain.findMany({ select: { id: true, slug: true } })).map(
      (d) => [d.slug, d.id],
    ),
  );

  // ----- Teams -----
  for (const t of content.teams) {
    const domainId = domainIdBySlug.get(t.domainSlug);
    if (!domainId) {
      throw new Error(
        `Seed Team '${t.slug}' references unknown domain '${t.domainSlug}'`,
      );
    }
    await db.team.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description ?? null,
        contact: t.contact ?? null,
        domainId,
      },
      create: {
        slug: t.slug,
        name: t.name,
        description: t.description ?? null,
        contact: t.contact ?? null,
        domainId,
      },
    });
  }

  const teamIdBySlug = new Map(
    (await db.team.findMany({ select: { id: true, slug: true } })).map((t) => [
      t.slug,
      t.id,
    ]),
  );

  // ----- Products + outboundLinks + (REPLACE) initiatives -----
  let initiativesCount = 0;
  let outboundLinksCount = 0;
  for (const p of content.products) {
    const domainId = domainIdBySlug.get(p.domainSlug);
    if (!domainId) {
      throw new Error(
        `Seed Product '${p.slug}' references unknown domain '${p.domainSlug}'`,
      );
    }
    const operatingTeamId = teamIdBySlug.get(p.operatingTeamSlug);
    if (!operatingTeamId) {
      throw new Error(
        `Seed Product '${p.slug}' references unknown team '${p.operatingTeamSlug}'`,
      );
    }
    const consumedByIds = p.consumedBy
      .map((slug) => jurisdictionIdBySlug.get(slug))
      .filter((id): id is string => id !== undefined);

    const product = await db.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description ?? null,
        stage: p.stage,
        domainId,
        operatingTeamId,
        consumedBy: { set: consumedByIds.map((id) => ({ id })) },
        ...(p.lastApprovedAt ? { lastApprovedAt: new Date(p.lastApprovedAt) } : {}),
        ...(p.lastApprovedBy ? { lastApprovedBy: p.lastApprovedBy } : {}),
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description ?? null,
        stage: p.stage,
        domainId,
        operatingTeamId,
        consumedBy: { connect: consumedByIds.map((id) => ({ id })) },
        ...(p.lastApprovedAt ? { lastApprovedAt: new Date(p.lastApprovedAt) } : {}),
        ...(p.lastApprovedBy ? { lastApprovedBy: p.lastApprovedBy } : {}),
      },
    });

    // Outbound links: REPLACE per Product, same pattern.
    await db.outboundLink.deleteMany({ where: { productId: product.id } });
    for (let i = 0; i < p.outboundLinks.length; i++) {
      const link = p.outboundLinks[i]!;
      await db.outboundLink.create({
        data: {
          productId: product.id,
          label: link.label,
          url: link.url,
          position: i,
        },
      });
      outboundLinksCount += 1;
    }

    // Initiatives: REPLACE per Product. The seed has stable IDs but
    // we let Prisma generate cuids — page lookups go by productId,
    // not by initiative ID, so the IDs aren't a stable contract.
    await db.initiative.deleteMany({ where: { productId: product.id } });
    const initiativesForProduct = content.initiatives.filter(
      (i) => i.productId === p.id,
    );
    for (let i = 0; i < initiativesForProduct.length; i++) {
      const init = initiativesForProduct[i]!;
      await db.initiative.create({
        data: {
          productId: product.id,
          bucket: init.bucket,
          title: init.title,
          description: init.description ?? null,
          outboundUrl: init.outboundUrl ?? null,
          position: i,
        },
      });
      initiativesCount += 1;
    }
  }

  return {
    jurisdictions: content.jurisdictions.length,
    domains: content.domains.length,
    themes: themesCount,
    teams: content.teams.length,
    products: content.products.length,
    initiatives: initiativesCount,
    outboundLinks: outboundLinksCount,
  };
}
