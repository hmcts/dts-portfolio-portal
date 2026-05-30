// Slug derivation per requirements spec §3.2 (Jurisdictions are a
// fixed taxonomy; Domains / Teams / Products get slugs at approve
// time). For Phase 2 baseline we auto-derive from the entity name;
// a future revision can let the approver override on the screen.

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    // strip accents
    .replace(/[̀-ͯ]/g, "")
    // collapse anything non-alphanumeric into a single dash
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Some entity names map cleanly to a known slug or are already a
// slug — accept either. The Jurisdiction taxonomy is fixed; this
// helper accepts the slug verbatim or maps a display name to its
// slug.
const JURISDICTION_SLUGS_BY_NAME: Record<string, string> = {
  crime: "crime",
  civil: "civil",
  family: "family",
  tribunals: "tribunals",
  administrative: "administrative",
};

export function normaliseJurisdictionRef(input: string): string | null {
  const lower = input.trim().toLowerCase();
  return JURISDICTION_SLUGS_BY_NAME[lower] ?? null;
}

// For Domain / Team references: accept either the slug or the name.
// Caller resolves against the actual row in the DB.
export function looksLikeSlug(input: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(input);
}
