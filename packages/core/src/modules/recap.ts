import { prisma } from "@famerace/db";

/**
 * Season Recap (PRD §0B: "Spotify Wrapped" pillar) — a user's season so far,
 * assembled into story slides. Pure read model: every number comes from the
 * same tables the rest of the product uses, so the story is always true.
 */
export async function seasonRecap(userId: string) {
  const [user, firstOrder, firstEntry, backedMarkets, passes, missionAgg, quests, crewMember, taste, tasteCount, nominations, claimedCalls] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, username: true, displayName: true, avatarUrl: true, createdAt: true, xp: true },
      }),
      prisma.fanDemandOrder.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: {
          draftProfile: { select: { id: true, nameOrHandle: true, fanCount: true } },
          creator: { select: { handle: true, displayName: true, avatarUrl: true } },
        },
      }),
      prisma.rosterEntry.findFirst({ where: { userId }, orderBy: { addedAt: "asc" } }),
      prisma.holding.findMany({
        where: { userId, amountUnits: { gt: 0 } },
        orderBy: { amountUnits: "desc" },
        include: {
          market: {
            select: {
              ticker: true,
              priceCents: true,
              holderCount: true,
              creator: { select: { handle: true, displayName: true, avatarUrl: true, fameScore: true } },
            },
          },
        },
      }),
      prisma.genesisPass.findMany({
        where: { userId },
        include: { creator: { select: { handle: true, displayName: true, avatarUrl: true } } },
        orderBy: { backerNumber: "asc" },
      }),
      prisma.missionContribution.aggregate({
        where: { userId, refunded: false },
        _count: true,
        _sum: { amountCents: true },
      }),
      prisma.questCompletion.count({ where: { userId, status: "APPROVED" } }),
      prisma.crewMember.findUnique({
        where: { userId },
        include: { crew: { select: { id: true, name: true, rank: true, score: true } } },
      }),
      prisma.tasteScore.findFirst({ where: { userId }, orderBy: { computedAt: "desc" } }),
      prisma.tasteScore.groupBy({ by: ["userId"] }).then((rows) => rows.length),
      prisma.scoutNomination.count({ where: { scoutUserId: userId } }),
      prisma.scoutNomination.count({ where: { scoutUserId: userId, claimResult: "CLAIMED" } }),
    ]);

  const topHolding = backedMarkets[0] ?? null;
  const bestRank = backedMarkets.reduce<number | null>(
    (best, h) => (h.backerRank !== null && (best === null || h.backerRank < best) ? h.backerRank : best),
    null,
  );
  const firstMoveAt = [firstOrder?.createdAt, firstEntry?.addedAt, passes[0]?.createdAt]
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    user,
    firstMove: firstOrder
      ? {
          at: firstOrder.createdAt,
          name: firstOrder.creator?.displayName ?? firstOrder.draftProfile?.nameOrHandle ?? "a rising creator",
          avatarUrl: firstOrder.creator?.avatarUrl ?? null,
          amountCents: firstOrder.amountCents,
        }
      : null,
    firstMoveAt,
    stats: {
      backedCount: backedMarkets.length,
      passCount: passes.length,
      missionsFunded: missionAgg._count,
      missionCents: missionAgg._sum.amountCents ?? 0,
      questsDone: quests,
      xp: user.xp,
      nominations,
      claimedCalls,
    },
    topHolding: topHolding
      ? {
          name: topHolding.market.creator.displayName,
          handle: topHolding.market.creator.handle,
          avatarUrl: topHolding.market.creator.avatarUrl,
          ticker: topHolding.market.ticker,
          units: topHolding.amountUnits,
          priceCents: topHolding.market.priceCents,
          holderCount: topHolding.market.holderCount,
          backerRank: topHolding.backerRank,
          fameScore: topHolding.market.creator.fameScore,
        }
      : null,
    bestRank,
    firstPass: passes[0]
      ? { name: passes[0].creator.displayName, backerNumber: passes[0].backerNumber }
      : null,
    crew: crewMember ? { name: crewMember.crew.name, rank: crewMember.crew.rank, points: crewMember.points } : null,
    taste: taste
      ? { score: taste.score, rank: taste.rank, percentile: taste.percentile, ofUsers: tasteCount, drivers: taste.drivers }
      : null,
    hasStory: Boolean(firstOrder || backedMarkets.length || passes.length || quests || nominations),
  };
}

export type SeasonRecap = Awaited<ReturnType<typeof seasonRecap>>;
