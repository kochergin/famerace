import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://famerace.fun";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/settings", "/notifications", "/roster", "/recap", "/img/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
