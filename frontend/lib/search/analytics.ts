// Write-path search analytics module — unavailable during the write-path
// re-platform. The Prisma client has been removed in the Group K cutover.
//
// The ops/search dashboard now reads aggregates from the Python backend.

export type SearchEventKind = "query" | "click";

export interface RecordQueryInput {
  query: string;
  resultCount: number;
  subject?: string | null;
}

export interface RecordClickInput {
  query: string;
  clickedEntityType: string;
  clickedEntityId: string;
  clickedPosition: number;
  subject?: string | null;
}

export async function recordSearchQuery(
  _input: RecordQueryInput,
): Promise<void> {
  throw new Error(
    "Search analytics write path unavailable: Prisma client removed in Group K cutover.",
  );
}

export async function recordSearchClick(
  _input: RecordClickInput,
): Promise<void> {
  throw new Error(
    "Search analytics write path unavailable: Prisma client removed in Group K cutover.",
  );
}

// DailySearchVolume is now also exported from @/lib/types.
// Re-exported here for any remaining local consumers.
export type { DailySearchVolume } from "@/lib/types";

export interface ZeroResultQuery {
  query: string;
  occurrences: number;
  lastSeenAt: Date;
}

export interface UnclickedQuery {
  query: string;
  occurrences: number;
  lastSeenAt: Date;
  topResultCount: number;
}

export async function getZeroResultQueries(
  _days: number,
  _limit?: number,
): Promise<ZeroResultQuery[]> {
  throw new Error(
    "Search analytics read path unavailable: Prisma client removed in Group K cutover.",
  );
}

export async function getUnclickedQueries(
  _days: number,
  _limit?: number,
): Promise<UnclickedQuery[]> {
  throw new Error(
    "Search analytics read path unavailable: Prisma client removed in Group K cutover.",
  );
}

export async function getDailySearchVolume(
  _days: number,
): Promise<import("@/lib/types").DailySearchVolume[]> {
  throw new Error(
    "Search analytics read path unavailable: Prisma client removed in Group K cutover.",
  );
}
