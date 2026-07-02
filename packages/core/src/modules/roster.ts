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

  // A claimed draft and its creator are the same person — collapse them.
  // If the roster also holds the creator entry, the stale draft entry is
  // dropped; otherwise the draft entry resolves through to the creator.
  const claimedDraftCreators = new Map(
    (
      await prisma.creator.findMany({
        where: { draftProfileId: { in: draftIds } },
        include: { market: { select: { ticker: true, priceCents: true, status: true } } },
      })
    ).map((c) => [c.draftProfileId as string, c]),
  );
  const creatorIdsOnRoster = new Set(creatorIds);

  const resolved = entries
    .map((entry) => {
      const claimedCreator = entry.draftProfileId
        ? claimedDraftCreators.get(entry.draftProfileId)
        : undefined;
      if (claimedCreator && creatorIdsOnRoster.has(claimedCreator.id)) return null; // duplicate person
      const creator = entry.creatorId
        ? (creatorMap.get(entry.creatorId) ?? null)
        : (claimedCreator ?? null);
      return {
        entry,
        creator,
        draft: !creator && entry.draftProfileId ? (draftMap.get(entry.draftProfileId) ?? null) : null,
        backed: creator ? backedCreatorIds.has(creator.id) : false,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    entries: resolved,
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
