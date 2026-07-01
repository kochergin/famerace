import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@famerace/core", "@famerace/db"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
