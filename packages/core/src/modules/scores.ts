import { prisma } from "@famerace/db";

// Taste Score (PRD §0A.15/§9A.8) and Fame Score (§9.14).
// Both are explainable: every score stores its drivers. No fake precision —
// integer scores, capped components, recomputed by sweeps (worker/cron).

type Driver = { label: string; points: number };

function clamp(n: number, max: number): number {
  return Math.min(max, Math.round(n));
}

/** Taste Score: a user's proven ability to find and back talent early. */
export async function computeTasteScore(userId: string): Promise<{ score: number; drivers: Driver[] }> {
  const [passes, holdings, claimedNominations, missionsFunded, questsDone, referrals, rosterCategories] =
    await Promise.all([
      prisma.genesisPass.findMany({ where: { userId }, select: { backerNumber: true } }),
      prisma.holding.findMany({ where: { userId, backerRank: { not: null } }, select: { backerRank: true } }),
      prisma.scoutNomination.count({ where: { scoutUserId: userId, claimResult: "CLAIMED" } }),
      prisma.missionContribution.groupBy({ by: ["missionId"], where: { userId, refunded: false } }),
      prisma.questCompletion.count({ where: { userId, status: "APPROVED" } }),
      prisma.user.count({ where: { referredByUserId: userId } }),
      prisma.rosterEntry.findMany({ where: { userId }, select: { creatorId: true, draftProfileId: true } }),
    ]);

  const drivers: Driver[] = [];
  // Earliness: low backer numbers/ranks are worth the most.
  const earliness = [...passes.map((p) => p.backerNumber), ...holdings.map((h) => h.backerRank ?? 999)]
    .map((rank) => (rank <= 10 ? 10 : rank <= 100 ? 6 : rank <= 500 ? 3 : 1))
    .reduce((sum, points) => sum + points, 0);
  if (earliness > 0) drivers.push({ label: "Backed early", points: clamp(earliness, 30) });
  if (claimedNominations > 0)
    drivers.push({ label: "Nominations that claimed", points: clamp(claimedNominations * 10, 25) });
  if (missionsFunded.length > 0)
    drivers.push({ label: "Missions funded", points: clamp(missionsFunded.length * 5, 20) });
  if (questsDone > 0) drivers.push({ label: "Street Team quests", points: clamp(questsDone * 2, 10) });
  if (referrals > 0) drivers.push({ label: "Organic invites", points: clamp(referrals * 2, 10) });
  if (rosterCategories.length >= 3)
    drivers.push({ label: "Roster breadth", points: clamp(rosterCategories.length, 5) });

  const score = clamp(
    drivers.reduce((sum, driver) => sum + driver.points, 0),
    100,
  );
  return { score, drivers };
}

/** Batch recompute + rank/percentile assignment. Returns users scored. */
export async function computeAllTasteScores(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const scored: { userId: string; score: number; drivers: Driver[] }[] = [];
  for (const user of users) {
    const { score, drivers } = await computeTasteScore(user.id);
    if (score > 0) scored.push({ userId: user.id, score, drivers });
  }
  scored.sort((a, b) => b.score - a.score);
  for (const [index, entry] of scored.entries()) {
    const previous = await prisma.tasteScore.findFirst({
      where: { userId: entry.userId },
      orderBy: { computedAt: "desc" },
    });
    await prisma.tasteScore.create({
      data: {
        userId: entry.userId,
        score: entry.score,
        rank: index + 1,
        percentile: scored.length > 1 ? Math.round((1 - index / (scored.length - 1)) * 100) : 100,
        drivers: entry.drivers,
        weeklyChange: entry.score - (previous?.score ?? 0),
      },
    });
  }
  return scored.length;
}

export async function latestTasteScore(userId: string) {
  return prisma.tasteScore.findFirst({ where: { userId }, orderBy: { computedAt: "desc" } });
}

/** Fame Score: creator momentum index — explainable, capped, no guarantees. */
export async function computeFameScore(creatorId: string): Promise<{ score: number; drivers: Driver[] }> {
  const creator = await prisma.creator.findUniqueOrThrow({
    where: { id: creatorId },
    include: { market: true },
  });
  const [passCount, memberCount, missions, questCompletions, backers] = await Promise.all([
    prisma.genesisPass.count({ where: { creatorId } }),
    prisma.backstageMembership.count({ where: { creatorId, status: "ACTIVE" } }),
    prisma.mission.findMany({ where: { creatorId }, select: { fundedCents: true, goalCents: true, status: true } }),
    prisma.questCompletion.count({ where: { quest: { creatorId }, status: "APPROVED" } }),
    prisma.holding.count({ where: { creatorMarketId: creator.market?.id ?? "", amountUnits: { gt: 0 } } }),
  ]);

  const drivers: Driver[] = [];
  const backerPoints = clamp(Math.sqrt(backers + passCount) * 4, 25);
  if (backerPoints > 0) drivers.push({ label: `${backers + passCount} backers`, points: backerPoints });
  const missionProgress = missions.reduce(
    (sum, m) => sum + Math.min(1, m.fundedCents / Math.max(1, m.goalCents)),
    0,
  );
  if (missionProgress > 0)
    drivers.push({ label: "Mission funding", points: clamp(missionProgress * 12, 25) });
  if (memberCount > 0)
    drivers.push({ label: `${memberCount} Backstage members`, points: clamp(Math.sqrt(memberCount) * 4, 15) });
  const volume = Number(creator.market?.volumeTotalCents ?? 0n);
  if (volume > 0) drivers.push({ label: "Market activity", points: clamp(Math.log10(volume / 100 + 1) * 4, 15) });
  if (questCompletions > 0)
    drivers.push({ label: "Street Team activity", points: clamp(questCompletions * 2, 10) });
  if (creator.followerGrowth7d > 0)
    drivers.push({ label: `+${Math.round(creator.followerGrowth7d * 100)}% follower growth`, points: clamp(creator.followerGrowth7d * 40, 10) });

  const score = clamp(
    drivers.reduce((sum, driver) => sum + driver.points, 0),
    100,
  );
  return { score, drivers };
}

export async function computeAllFameScores(): Promise<number> {
  const creators = await prisma.creator.findMany({
    where: { status: { in: ["APPROVED", "LAUNCHING_SOON", "LIVE", "PAUSED"] } },
    select: { id: true, fameScore: true, category: true },
  });
  const results: { creatorId: string; score: number; drivers: Driver[]; previous: number; category: string }[] = [];
  for (const creator of creators) {
    const { score, drivers } = await computeFameScore(creator.id);
    results.push({ creatorId: creator.id, score, drivers, previous: creator.fameScore, category: creator.category });
  }
  for (const result of results) {
    const inCategory = results.filter((r) => r.category === result.category);
    const below = inCategory.filter((r) => r.score < result.score).length;
    await prisma.fameScore.create({
      data: {
        creatorId: result.creatorId,
        score: result.score,
        previousScore: result.previous,
        drivers: result.drivers,
        categoryPercentile: inCategory.length > 1 ? Math.round((below / (inCategory.length - 1)) * 100) : 100,
        confidence: 0.6,
      },
    });
    await prisma.creator.update({ where: { id: result.creatorId }, data: { fameScore: result.score } });
  }
  return results.length;
}

export async function latestFameScore(creatorId: string) {
  return prisma.fameScore.findFirst({ where: { creatorId }, orderBy: { computedAt: "desc" } });
}

/** Top scouts leaderboard (PRD §4.5). */
export async function topScouts(limit = 20) {
  const grouped = await prisma.scoutNomination.groupBy({
    by: ["scoutUserId"],
    _count: true,
    orderBy: { _count: { scoutUserId: "desc" } },
    take: limit * 2,
  });
  const claimed = await prisma.scoutNomination.groupBy({
    by: ["scoutUserId"],
    where: { claimResult: "CLAIMED" },
    _count: true,
  });
  const claimedMap = new Map(claimed.map((c) => [c.scoutUserId, c._count]));
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.scoutUserId) } },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return grouped
    .map((g) => ({
      user: userMap.get(g.scoutUserId),
      nominations: g._count,
      claimed: claimedMap.get(g.scoutUserId) ?? 0,
    }))
    .filter((row) => row.user)
    .sort((a, b) => b.claimed - a.claimed || b.nominations - a.nominations)
    .slice(0, limit);
}
