import { prisma } from "@famerace/db";

/**
 * Top Supporters (the whale layer): who has put the most behind a creator
 * across passes, missions, drops and tips. Status is the product — tiers are
 * public and permanent-feeling. All figures are commerce, not market volume.
 */

export const SUPPORTER_TIERS = [
  { minCents: 50_000, label: "SUPERFAN" },
  { minCents: 25_000, label: "VIP" },
  { minCents: 5_000, label: "INSIDER" },
  { minCents: 1, label: "BACKER" },
] as const;

export function tierFor(totalCents: number): string {
  return SUPPORTER_TIERS.find((t) => totalCents >= t.minCents)?.label ?? "BACKER";
}

export async function topSupporters(creatorId: string, limit = 8) {
  const [passes, missions, dropPurchases, tips] = await Promise.all([
    prisma.genesisPass.groupBy({ by: ["userId"], where: { creatorId }, _sum: { tierCents: true } }),
    prisma.missionContribution.groupBy({
      by: ["userId"],
      where: { refunded: false, mission: { creatorId } },
      _sum: { amountCents: true },
    }),
    prisma.dropPurchase.groupBy({
      by: ["userId"],
      where: { drop: { creatorId } },
      _sum: { priceCents: true },
    }),
    prisma.tip.groupBy({ by: ["fromUserId"], where: { creatorId }, _sum: { amountCents: true } }),
  ]);

  const totals = new Map<string, number>();
  const add = (userId: string, cents: number | null) =>
    totals.set(userId, (totals.get(userId) ?? 0) + (cents ?? 0));
  for (const row of passes) add(row.userId, row._sum.tierCents);
  for (const row of missions) add(row.userId, row._sum.amountCents);
  for (const row of dropPurchases) add(row.userId, row._sum.priceCents);
  for (const row of tips) add(row.fromUserId, row._sum.amountCents);

  const top = [...totals.entries()]
    .filter(([, cents]) => cents > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (top.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, username: true, avatarUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return top
    .map(([userId, cents], index) => {
      const user = byId.get(userId);
      return user ? { rank: index + 1, user, totalCents: cents, tier: tierFor(cents) } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}
