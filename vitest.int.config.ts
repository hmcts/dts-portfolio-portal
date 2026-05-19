import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config for integration tests. These run against a real
// Postgres (the `db` service from docker-compose locally, the
// service-container Postgres in CI). They live in *.int.test.ts
// files and are excluded from the default `pnpm test` so unit tests
// stay fast.

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.int.test.ts"],
    pool: "forks",
    // Integration tests share a Postgres connection and clean state
    // via TRUNCATE in beforeEach. Run serially so we don't race
    // against ourselves.
    fileParallelism: false,
    isolate: false,
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
