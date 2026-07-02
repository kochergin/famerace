import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@famerace/core", "@famerace/db"],
  serverExternalPackages: ["@prisma/client", "@resvg/resvg-js"],
  experimental: {
    // Route cinema: React <ViewTransition> + native shared-element morphs
    // (see the face morph names and ::view-transition-* rules in globals.css).
    viewTransition: true,
  },
};

export default nextConfig;
