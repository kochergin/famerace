import Link from "next/link";
import { prisma } from "@famerace/db";
import type { CreatorCategory } from "@famerace/db";
import { EmptyState, SectionTitle, StatusChip } from "@/components/ui";
import { CATEGORY_LABELS, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const SORTS = [
  { key: "fame", label: "Fame Score" },
  { key: "backed", label: "Most backed" },
  { key: "growth", label: "Fastest growth" },
  { key: "missions", label: "Top missions" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

/** FameRace 100 (PRD §4.6): the media layer — rankings across the Fame Index. */
export default async function FameRace100Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category, sort: rawSort } = await searchParams;
  const sort: SortKey = SORTS.some((s) => s.key === rawSort) ? (rawSort as SortKey) : "fame";

  const creators = await prisma.creator.findMany({
    where: {
      status: { in: ["APPROVED", "LAUNCHING_SOON", "LIVE", "PAUSED"] },
      ...(category ? { category: category as CreatorCategory } : {}),
    },
    include: {
      market: { select: { ticker: true, holderCount: true, volumeTotalCents: true, status: true } },
      fameScores: { orderBy: { computedAt: "desc" }, take: 1 },
      missions: {
        where: { status: { in: ["LIVE", "FUNDED", "IN_PROGRESS", "COMPLETED"] } },
        select: { fundedCents: true, goalCents: true },
      },
      _count: { select: { genesisPasses: true } },
    },
    take: 200,
  });

  const scored = creators
    .map((creator) => {
      const latest = creator.fameScores[0];
      const change = latest ? latest.score - latest.previousScore : 0;
      const backed = (creator.market?.holderCount ?? 0) + creator._count.genesisPasses;
      const missionProgress = creator.missions.reduce(
        (sum, m) => sum + Math.min(1, m.fundedCents / Math.max(1, m.goalCents)),
        0,
      );
      return { creator, change, backed, missionProgress };
    })
    .sort((a, b) => {
      switch (sort) {
        case "backed":
          return b.backed - a.backed;
        case "growth":
          return b.change - a.change || b.creator.fameScore - a.creator.fameScore;
        case "missions":
          return b.missionProgress - a.missionProgress || b.creator.fameScore - a.creator.fameScore;
        default:
          return b.creator.fameScore - a.creator.fameScore;
      }
    })
    .slice(0, 100);

  const link = (c?: string, s?: string) => {
    const q = new URLSearchParams();
    if (c) q.set("category", c);
    if (s && s !== "fame") q.set("sort", s);
    const str = q.toString();
    return `/famerace-100${str ? `?${str}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle>FameRace 100</SectionTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        The weekly momentum rankings. Fame Score is an explainable index — backers, missions,
        Backstage, Street Team, growth — never a guarantee.
      </p>
      <div className="mb-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={link(category, s.key)}
            className={`chip border ${sort === s.key ? "border-pink text-pink" : "border-edge text-muted"}`}
          >
            {s.label}
          </Link>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
        <Link href={link(undefined, sort)} className={`chip border ${!category ? "border-lime text-lime" : "border-edge text-muted"}`}>
          Overall
        </Link>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={link(key, sort)}
            className={`chip border ${category === key ? "border-lime text-lime" : "border-edge text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {scored.length === 0 ? (
        <EmptyState title="No ranked creators yet" hint="Rankings open as creators claim and launch." />
      ) : (
        <ol className="card divide-y divide-edge">
          {scored.map(({ creator, change, backed, missionProgress }, index) => (
            <li key={creator.id} className="flex items-center justify-between gap-2 px-5 py-3">
              <Link href={`/c/${creator.handle}`} className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-80">
                <span className="stat w-8 shrink-0 text-right text-muted">#{index + 1}</span>
                <span className="min-w-0">
                  <span className="font-semibold text-chalk">{creator.displayName}</span>{" "}
                  <span className="text-xs text-muted">
                    {creator.market ? `$${creator.market.ticker} · ` : ""}
                    {CATEGORY_LABELS[creator.category]}
                    {creator.followerCount > 0 ? ` · ${num(creator.followerCount)} followers` : ""}
                  </span>{" "}
                  <StatusChip
                    status={
                      creator.market?.status === "GRADUATION" || creator.market?.status === "MATURE"
                        ? creator.market.status
                        : creator.status
                    }
                  />
                </span>
              </Link>
              <span className="stat flex shrink-0 items-center gap-3 text-sm">
                <span className="hidden text-muted sm:inline">
                  {sort === "backed"
                    ? `${num(backed)} backers`
                    : sort === "missions"
                      ? `${Math.round(missionProgress * 100)}% missions`
                      : creator.market
                        ? money(creator.market.volumeTotalCents, { compact: true })
                        : ""}
                </span>
                <span className="font-bold text-lime">{creator.fameScore}</span>
                {change !== 0 ? (
                  <span className={change > 0 ? "text-lime" : "text-pink"}>
                    {change > 0 ? `▲${change}` : `▼${Math.abs(change)}`}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
                {index > 0 ? (
                  <a
                    href={`/card/battle/${scored[0]!.creator.handle}:${creator.handle}`}
                    target="_blank"
                    className="text-pink"
                    title={`Battle card: ${scored[0]!.creator.displayName} vs ${creator.displayName}`}
                  >
                    ⚔
                  </a>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
