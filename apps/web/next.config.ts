import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@famerace/core", "@famerace/db"],
  serverExternalPackages: ["@prisma/client", "@resvg/resvg-js"],
};

export default nextConfig;
