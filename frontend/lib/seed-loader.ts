// Seed-loader — unavailable during the write-path re-platform.
// The Prisma client has been removed in the Group K cutover.
// The Python backend manages its own seed via Alembic + SQLModel.

export interface SeedLoadResult {
  jurisdictions: number;
  domains: number;
  themes: number;
  teams: number;
  products: number;
  initiatives: number;
  outboundLinks: number;
}

export async function loadSeedIntoDb(): Promise<SeedLoadResult> {
  throw new Error(
    "Seed loader unavailable: Prisma client removed in Group K cutover. " +
      "Use the Python backend's seed mechanism instead.",
  );
}
