import { prisma } from "@famerace/db";
import { notFound } from "../errors";
import { latestTasteScore } from "./scores";

// Roster (PRD §0A.14, §9.16): "My Roster", never "portfolio".

export async function addCreatorToRoster(userId: string, creatorId: string) {
  await prisma.rosterEntry.upsert({
    where: { userId_creatorId: { userId, creatorId } },
    create: { userId, creatorId, source: "WATCHING" },
    update: {},
  });
}

export async function removeFromRoster(userId: string, entryId: string) {
  const entry = await prisma.rosterEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw notFound("Roster entry");
  await prisma.rosterEntry.delete({ where: { id: entryId } });
}

export async function rosterFor(userId: string) {
  const entries = await prisma.rosterEntry.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });
  const creatorIds = entries.map((e) => e.creatorId).filter((x): x is string => !!x);
  const draftIds = entries.map((e) => e.draftProfileId).filter((x): x is string => !!x);
  const [creators, drafts, taste, holdings, passes, contributions] = await Promise.all([
    prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      include: { market: { select: { ticker: true, priceCents: true, status: true } } },
    }),
    prisma.draftProfile.findMany({ where: { id: { in: draftIds } } }),
    latestTasteScore(userId),
    prisma.holding.findMany({ where: { userId, amountUnits: { gt: 0 } } }),
    prisma.genesisPass.findMany({ where: { userId } }),
    prisma.missionContribution.groupBy({ by: ["missionId"], where: { userId, refunded: false } }),
  ]);
  const creatorMap = new Map(creators.map((c) => [c.id, c]));
  const draftMap = new Map(drafts.map((d) => [d.id, d]));
  const backedCreatorIds = new Set([
    ...passes.map((p) => p.creatorId),
    ...entries.filter((e) => e.source === "BACKED").map((e) => e.creatorId),
  ]);
  return {
    entries: entries.map((entry) => ({
      entry,
      creator: entry.creatorId ? (creatorMap.get(entry.creatorId) ?? null) : null,
      draft: entry.draftProfileId ? (draftMap.get(entry.draftProfileId) ?? null) : null,
      backed: entry.creatorId ? backedCreatorIds.has(entry.creatorId) : false,
    })),
    taste,
    stats: {
      backedCount: backedCreatorIds.size,
      holdingCount: holdings.length,
      passCount: passes.length,
      missionsFunded: contributions.length,
    },
  };
}

/** Public profile surface (PRD §9.1). */
export async function publicProfile(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
      status: true,
      roles: true,
      xp: true,
      points: true,
      badges: { orderBy: { awardedAt: "desc" }, take: 30 },
      crewMemberships: { include: { crew: { select: { id: true, name: true, rank: true } } } },
    },
  });
  if (!user || user.status !== "ACTIVE") throw notFound("User");
  const [taste, nominations, claimed, roster] = await Promise.all([
    latestTasteScore(user.id),
    prisma.scoutNomination.count({ where: { scoutUserId: user.id } }),
    prisma.scoutNomination.count({ where: { scoutUserId: user.id, claimResult: "CLAIMED" } }),
    rosterFor(user.id),
  ]);
  return { user, taste, nominations, claimed, roster };
}
