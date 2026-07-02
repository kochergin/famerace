import type { MetadataRoute } from "next";
import { prisma } from "@famerace/db";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://famerace.fun";

/** Draft and creator pages are the SEO surface — fans searching a rising
 *  name should land here (§0A nomination loop). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [drafts, creators] = await Promise.all([
    prisma.draftProfile.findMany({
      where: { moderationStatus: "APPROVED", takedownStatus: "NONE" },
      select: { id: true, updatedAt: true },
      take: 5000,
    }),
    prisma.creator.findMany({
      where: { status: { in: ["LAUNCHING_SOON", "LIVE"] } },
      select: { handle: true, updatedAt: true },
      take: 5000,
    }),
  ]);
  const statics: MetadataRoute.Sitemap = ["", "/draft", "/live", "/launching", "/missions", "/famerace-100", "/draft-day", "/scouts", "/crews"].map(
    (path) => ({ url: `${BASE}${path}`, changeFrequency: "hourly" as const, priority: path === "" ? 1 : 0.8 }),
  );
  return [
    ...statics,
    ...drafts.map((d) => ({
      url: `${BASE}/draft/${d.id}`,
      lastModified: d.updatedAt,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
    ...creators.map((c) => ({
      url: `${BASE}/c/${c.handle}`,
      lastModified: c.updatedAt,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
  ];
}
