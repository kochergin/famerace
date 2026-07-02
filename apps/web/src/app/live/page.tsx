import Link from "next/link";
import { prisma } from "@famerace/db";
import { Monogram } from "@/components/monogram";
import { EmptyState, SectionTitle, Stat, StatusChip } from "@/components/ui";
import { CATEGORY_LABELS, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const creators = await prisma.creator.findMany({
    where: { status: { in: ["LIVE", "PAUSED"] } },
    include: { market: true },
    orderBy: [{ fameScore: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div>
      <SectionTitle>Live Now</SectionTitle>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Verified creators with open markets. Back the rise, fund missions, join Backstage.
      </p>
      {creators.length === 0 ? (
        <EmptyState title="No live markets yet" hint="The first launches land on Draft Day." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((creator) => (
            <Link key={creator.id} href={`/c/${creator.handle}`} className="card block p-5 transition hover:border-lime">
              <div className="flex items-start justify-between">
                <p className="stat text-xs text-muted">
                  {creator.market ? `$${creator.market.ticker}` : ""} · {CATEGORY_LABELS[creator.category]}
                </p>
                <StatusChip status={creator.market?.status === "PAUSED" ? "PAUSED" : "LIVE"} />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Monogram
                  name={creator.displayName}
                  src={creator.avatarUrl}
                  size="md"
                  ring={creator.market?.status === "PAUSED" ? "none" : "live"}
                  morph={creator.handle}
                />
                <h3 className="display min-w-0 truncate text-3xl">{creator.displayName}</h3>
              </div>
              {creator.followerCount > 0 ? (
                <p className="stat mt-0.5 text-xs text-pink">{num(creator.followerCount)} followers</p>
              ) : null}
              {creator.bio ? <p className="mt-1 line-clamp-2 text-sm text-muted">{creator.bio}</p> : null}
              {creator.market ? (
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-edge pt-3">
                  <Stat label="Price" value={money(creator.market.priceCents)} accent="text-lime" />
                  <Stat label="Holders" value={num(creator.market.holderCount)} />
                  <Stat label="Volume" value={money(creator.market.volumeTotalCents, { compact: true })} />
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
