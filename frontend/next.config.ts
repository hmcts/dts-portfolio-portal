import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin Turbopack root so it doesn't get confused by the monorepo lockfiles.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
