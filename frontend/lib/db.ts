import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One PrismaClient per process. In dev, Next.js HMR reloads modules; the
// `globalThis` cache prevents the dev server from opening a new pool on
// every reload, which exhausts Postgres connection limits quickly.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local for local dev, or rely on Azure Key Vault + managed identity in deployed environments (see ADR-008).",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
