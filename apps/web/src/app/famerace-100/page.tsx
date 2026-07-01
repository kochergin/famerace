import Link from "next/link";
import { prisma } from "@famerace/db";
import type { CreatorCategory } from "@famerace/db";
import { EmptyState, SectionTitle, StatusChip } from "@/components/ui";
import { CATEGORY_LABELS, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

/** FameRace 100 (PRD §4.6): the media layer — weekly rankings by Fame Score. */
export default async function FameRace100Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const creators = await prisma.creator.findMany({
    where: {
      status: { in: ["APPROVED", "LAUNCHING_SOON", "LIVE", "PAUSED"] },
      ...(category ? { category: category as CreatorCategory } : {}),
    },
    include: {
      market: { select: { ticker: true, holderCount: true, volumeTotalCents: true } },
      fameScores: { orderBy: { computedAt: "desc" }, take: 1 },
    },
    orderBy: [{ fameScore: "desc" }, { createdAt: "asc" }],
    take: 100,
  });

  const filterLink = (c?: string) => (c ? `/famerace-100?category=${c}` : "/famerace-100");

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle>FameRace 100</SectionTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        The weekly momentum ranking. Fame Score is an explainable index — backers, missions,
        Backstage, Street Team, growth — never a guarantee.
      </p>
      <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
        <Link href={filterLink()} className={`chip border ${!category ? "border-lime text-lime" : "border-edge text-muted"}`}>
          Overall
        </Link>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={filterLink(key)}
            className={`chip border ${category === key ? "border-lime text-lime" : "border-edge text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {creators.length === 0 ? (
        <EmptyState title="No ranked creators yet" hint="Rankings open as creators claim and launch." />
      ) : (
        <ol className="card divide-y divide-edge">
          {creators.map((creator, index) => {
            const latest = creator.fameScores[0];
            const change = latest ? latest.score - latest.previousScore : 0;
            return (
              <li key={creator.id}>
                <Link
                  href={`/c/${creator.handle}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-panel"
                >
                  <span className="flex items-center gap-3">
                    <span className="stat w-8 text-right text-muted">#{index + 1}</span>
                    <span>
                      <span className="font-semibold text-chalk">{creator.displayName}</span>{" "}
                      <span className="text-xs text-muted">
                        {creator.market ? `$${creator.market.ticker} · ` : ""}
                        {CATEGORY_LABELS[creator.category]}
                      </span>
                    </span>
                    <StatusChip status={creator.status} />
                  </span>
                  <span className="stat flex items-center gap-3 text-sm">
                    {creator.market ? (
                      <span className="hidden text-muted sm:inline">
                        {num(creator.market.holderCount)} holders · {money(creator.market.volumeTotalCents, { compact: true })}
                      </span>
                    ) : null}
                    <span className="font-bold text-lime">{creator.fameScore}</span>
                    {change !== 0 ? (
                      <span className={change > 0 ? "text-lime" : "text-pink"}>
                        {change > 0 ? `▲${change}` : `▼${Math.abs(change)}`}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
