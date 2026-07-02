import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@famerace/core", "@famerace/db"],
  serverExternalPackages: ["@prisma/client", "@resvg/resvg-js"],
  experimental: {
    // Route cinema: React <ViewTransition> + native shared-element morphs
    // (see the face morph names and ::view-transition-* rules in globals.css).
    viewTransition: true,
  },
  async headers() {
    return [
      {
        // Everything except /embed: no framing (clickjacking), no sniffing.
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // The embed widget is explicitly frameable — that's its whole job.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
