-- Postgres full-text search columns + GIN indexes per ADR-004 / spec §6.1.
--
-- Each searchable entity gets a `searchTsv` tsvector column GENERATED
-- ALWAYS from the relevant text fields. That means:
--   1. We never have to remember to keep the index in sync (the DB
--      regenerates the tsvector on every INSERT and UPDATE)
--   2. No application-layer triggers to maintain
--   3. No risk of stale search results from missed indexing events
--
-- Query path (in src/lib/search/search.ts) uses `websearch_to_tsquery`
-- so users can paste natural-language queries (`"common platform"
-- -legacy`) directly.
--
-- Initiatives use `title` (not `name`) as their headline field per
-- the schema. The search API normalises this to `name` in its output.

ALTER TABLE "Jurisdiction" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
CREATE INDEX "Jurisdiction_searchTsv_idx" ON "Jurisdiction" USING GIN ("searchTsv");

ALTER TABLE "ProductDomain" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
CREATE INDEX "ProductDomain_searchTsv_idx" ON "ProductDomain" USING GIN ("searchTsv");

ALTER TABLE "Team" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ||
    setweight(to_tsvector('english', coalesce(contact, '')), 'D')
  ) STORED;
CREATE INDEX "Team_searchTsv_idx" ON "Team" USING GIN ("searchTsv");

ALTER TABLE "Product" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX "Product_searchTsv_idx" ON "Product" USING GIN ("searchTsv");

ALTER TABLE "Initiative" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
CREATE INDEX "Initiative_searchTsv_idx" ON "Initiative" USING GIN ("searchTsv");
