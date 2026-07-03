import { NextRequest } from "next/server";
import { prisma } from "@famerace/db";

export const dynamic = "force-dynamic";

const PAGES = [
  { label: "Draft Board", href: "/draft" },
  { label: "Live markets", href: "/live" },
  { label: "Calls — predictions", href: "/calls" },
  { label: "Launching soon", href: "/launching" },
  { label: "Missions", href: "/missions" },
  { label: "FameRace 100", href: "/famerace-100" },
  { label: "My roster", href: "/roster" },
  { label: "Crews", href: "/crews" },
  { label: "Wallet", href: "/wallet" },
  { label: "Nominate a creator", href: "/nominate" },
  { label: "Season recap", href: "/recap" },
  { label: "Settings", href: "/settings" },
];

/** ⌘K search: creators, draft profiles, people, pages — one box. */
export async function GET(request: NextRequest): Promise<Response> {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return Response.json({ results: [] });
  const like = { contains: q, mode: "insensitive" as const };

  const [creators, drafts, people] = await Promise.all([
    prisma.creator.findMany({
      where: {
        status: { in: ["LAUNCHING_SOON", "LIVE", "PAUSED"] },
        OR: [{ handle: like }, { displayName: like }],
      },
      select: { handle: true, displayName: true, avatarUrl: true, status: true },
      take: 5,
    }),
    prisma.draftProfile.findMany({
      where: { nameOrHandle: like, moderationStatus: "APPROVED", takedownStatus: "NONE" },
      select: { id: true, nameOrHandle: true, lastRank: true, fanCount: true },
      take: 4,
    }),
    prisma.user.findMany({
      where: { username: like },
      select: { username: true, avatarUrl: true },
      take: 3,
    }),
  ]);

  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())).slice(0, 3);

  return Response.json({
    results: [
      ...creators.map((c) => ({
        group: "Creators",
        label: c.displayName,
        sub: `@${c.handle} · ${c.status === "LIVE" ? "live" : "launching"}`,
        href: `/c/${c.handle}`,
        avatarUrl: c.avatarUrl,
        name: c.displayName,
      })),
      ...drafts.map((d) => ({
        group: "Draft Board",
        label: d.nameOrHandle,
        sub: d.lastRank ? `#${d.lastRank} on the board` : `${d.fanCount} fans waiting`,
        href: `/draft/${d.id}`,
        name: d.nameOrHandle,
      })),
      ...people.map((u) => ({
        group: "People",
        label: `@${u.username}`,
        sub: "profile",
        href: `/u/${u.username}`,
        avatarUrl: u.avatarUrl,
        name: u.username,
      })),
      ...pages.map((p) => ({ group: "Go to", label: p.label, sub: p.href, href: p.href, name: p.label })),
    ],
  });
}
