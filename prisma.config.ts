// Prisma 7 configuration. The CLI (migrate, db push, studio) reads
// connection details from this file rather than from `schema.prisma`.
// The runtime PrismaClient uses the driver-adapter pattern in
// src/lib/db.ts to make the same connection — kept in sync via the
// shared DATABASE_URL.

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
