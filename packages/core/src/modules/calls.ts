import { prisma, type Call, type CallMetric, type CallSide, type Prisma } from "@famerace/db";
import { z } from "zod";
import { DomainError, notFound } from "../errors";
import { publish } from "../bus";
import { notify } from "./notify";
import { moneyTx } from "../tx";

/**
 * Calls (prediction layer): time-boxed public predictions on creators,
 * staked with Taste Points — never cash (keeps this a skill game, not a
 * regulated wager). Resolution is objective: every call names an internal
 * metric + threshold and the sweep resolves it automatically at deadline.
 * Parimutuel: winners get their stake back plus a pro-rata share of the
 * losing pool (largest-remainder, so every point is accounted for).
 */

const callSchema = z.object({
  creatorId: z.string(),
  question: z.string().min(10).max(140),
  metric: z.enum(["HOLDER_COUNT", "FAME_SCORE", "PRICE_CENTS", "MISSION_FUNDED", "CONFIRMED_BACKERS"]),
  threshold: z.number().int().positive(),
  missionId: z.string().optional(),
  deadlineHours: z.number().int().min(1).max(24 * 60).default(72),
});

export async function createCall(actorUserId: string, input: z.input<typeof callSchema>) {
  const data = callSchema.parse(input);
  const actor = await prisma.user.findUniqueOrThrow({ where: { id: actorUserId }, select: { roles: true } });
  const self = await prisma.creator.findFirst({ where: { userId: actorUserId, id: data.creatorId } });
  if (!actor.roles.some((r) => r === "ADMIN" || r === "MODERATOR") && !self) {
    throw new DomainError("FORBIDDEN", "Only the platform or the creator can open a call");
  }
  if (data.metric === "MISSION_FUNDED" && !data.missionId) {
    throw new DomainError("MISSION_REQUIRED", "Mission calls need a mission");
  }
  const creator = await prisma.creator.findUnique({ where: { id: data.creatorId }, select: { displayName: true } });
  if (!creator) throw notFound("Creator");
  const call = await prisma.call.create({
    data: {
      creatorId: data.creatorId,
      missionId: data.missionId ?? null,
      question: data.question,
      metric: data.metric,
      threshold: data.threshold,
      deadline: new Date(Date.now() + data.deadlineHours * 3600_000),
      createdByUserId: actorUserId,
    },
  });
  publish({
    id: `call-${call.id}`,
    type: "CALL_OPENED",
    message: `New call on ${creator.displayName}: ${data.question}`,
    createdAt: new Date().toISOString(),
    creatorId: data.creatorId,
  });
  return call;
}

/** YES share of the pool, 0..1, or null before anyone stakes. */
export function yesShare(call: Pick<Call, "yesPoints" | "noPoints">): number | null {
  const total = call.yesPoints + call.noPoints;
  return total > 0 ? call.yesPoints / total : null;
}

export async function stake(userId: string, callId: string, side: CallSide, points: number) {
  if (!Number.isInteger(points) || points <= 0) {
    throw new DomainError("BAD_STAKE", "Stake a whole number of Taste Points");
  }
  return moneyTx(async (tx) => {
    const call = await tx.call.findUnique({ where: { id: callId }, include: { creator: { select: { displayName: true } } } });
    if (!call) throw notFound("Call");
    if (call.status !== "OPEN") throw new DomainError("CALL_CLOSED", "This call has already resolved");
    if (call.deadline.getTime() <= Date.now()) throw new DomainError("CALL_LOCKED", "This call is past its deadline");
    const existing = await tx.callStake.findUnique({ where: { callId_userId: { callId, userId } } });
    if (existing) throw new DomainError("ALREADY_STAKED", "One position per call — you are already in");
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { points: true, username: true, callStreak: true, lastStakeDay: true },
    });
    // Conditional debit: the WHERE clause makes overdraw impossible even if
    // two stakes race past the read above (defense in depth on top of the
    // serializable transaction).
    const debit = await tx.user.updateMany({
      where: { id: userId, points: { gte: points } },
      data: { points: { decrement: points } },
    });
    if (debit.count === 0) {
      throw new DomainError("NOT_ENOUGH_POINTS", `You have ${user.points} Taste Points — earn more by backing, funding and quests`);
    }
    const stakeRow = await tx.callStake.create({ data: { callId, userId, side, points } });

    // Taste streak: consecutive UTC days with at least one call made.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const last = user.lastStakeDay ? new Date(user.lastStakeDay) : null;
    if (!last || last.getTime() !== today.getTime()) {
      const yesterday = today.getTime() - 24 * 60 * 60 * 1000;
      const streak = last && last.getTime() === yesterday ? user.callStreak + 1 : 1;
      await tx.user.update({ where: { id: userId }, data: { callStreak: streak, lastStakeDay: today } });
    }

    const shareBefore = yesShare(call);
    const updated = await tx.call.update({
      where: { id: callId },
      data: side === "YES" ? { yesPoints: { increment: points } } : { noPoints: { increment: points } },
    });
    const share = yesShare(updated);

    // The dopamine loop: when the majority flips, everyone in the call hears it.
    if (shareBefore !== null && share !== null && shareBefore !== 0.5 && (shareBefore > 0.5) !== (share > 0.5)) {
      const flippedTo = share > 0.5 ? "YES" : "NO";
      const others = await tx.callStake.findMany({ where: { callId, userId: { not: userId } }, select: { userId: true } });
      for (const other of others) {
        await notify(tx, {
          userId: other.userId,
          type: "TASTE_SCORE_UPDATE",
          title: `The internet flipped to ${flippedTo}`,
          body: `"${call.question}" is now ${Math.round(share * 100)}% yes.`,
          link: "/calls",
        });
      }
    }
    publish({
      id: `stake-${stakeRow.id}`,
      type: "CALL_STAKED",
      message: `@${user.username} called ${side} on ${call.creator.displayName} — the internet says ${share === null ? "—" : `${Math.round(share * 100)}%`} yes`,
      createdAt: new Date().toISOString(),
      creatorId: call.creatorId,
    });
    return { stake: stakeRow, call: updated };
  });
}

/**
 * Platform-authored calls so the board is never empty (sweep-driven,
 * idempotent): every launch window and every fresh market gets a call.
 */
export async function ensureAutoCalls(now = new Date()): Promise<number> {
  let created = 0;

  // Launch-window calls: will they beat their backer threshold before launch?
  const launching = await prisma.creator.findMany({
    where: { status: "LAUNCHING_SOON", launchAt: { gt: now } },
    include: { launchThreshold: true, calls: { where: { status: "OPEN", metric: "CONFIRMED_BACKERS" } } },
  });
  for (const creator of launching) {
    if (!creator.launchThreshold || !creator.launchAt || creator.calls.length > 0) continue;
    const stretch = Math.max(creator.launchThreshold.requiredBackers + 2, Math.ceil(creator.launchThreshold.confirmedBackers * 1.5));
    await prisma.call.create({
      data: {
        creatorId: creator.id,
        question: `Will ${creator.displayName} hit ${stretch} confirmed backers before launch?`,
        metric: "CONFIRMED_BACKERS",
        threshold: stretch,
        deadline: creator.launchAt,
        createdByUserId: creator.userId ?? creator.id,
      },
    });
    created += 1;
  }

  // Fresh-market calls: will the crowd double inside the first week?
  const fresh = await prisma.creatorMarket.findMany({
    where: {
      status: { in: ["GENESIS_CURVE", "GRADUATION"] },
      createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
    },
    include: { creator: { include: { calls: { where: { status: "OPEN", metric: "HOLDER_COUNT" } } } } },
  });
  for (const market of fresh) {
    if (market.creator.calls.length > 0) continue;
    const stretch = Math.max(10, market.holderCount * 2);
    await prisma.call.create({
      data: {
        creatorId: market.creatorId,
        question: `Will ${market.creator.displayName} pass ${stretch} backers this week?`,
        metric: "HOLDER_COUNT",
        threshold: stretch,
        deadline: new Date(now.getTime() + 72 * 3600_000),
        createdByUserId: market.creator.userId ?? market.creatorId,
      },
    });
    created += 1;
  }
  return created;
}

/** The call with the most conviction behind it — the homepage front door. */
export async function hottestCall() {
  const open = await openCalls(20);
  return open.sort((a, b) => b.yesPoints + b.noPoints - (a.yesPoints + a.noPoints))[0] ?? null;
}

/** Current live value of a call's metric (all internal — objectively checkable). */
export async function metricValue(call: Pick<Call, "metric" | "creatorId" | "missionId">): Promise<number> {
  switch (call.metric) {
    case "HOLDER_COUNT": {
      const market = await prisma.creatorMarket.findUnique({ where: { creatorId: call.creatorId }, select: { holderCount: true } });
      return market?.holderCount ?? 0;
    }
    case "PRICE_CENTS": {
      const market = await prisma.creatorMarket.findUnique({ where: { creatorId: call.creatorId }, select: { priceCents: true } });
      return market?.priceCents ?? 0;
    }
    case "FAME_SCORE": {
      const creator = await prisma.creator.findUniqueOrThrow({ where: { id: call.creatorId }, select: { fameScore: true } });
      return creator.fameScore;
    }
    case "CONFIRMED_BACKERS": {
      const threshold = await prisma.launchThreshold.findUnique({ where: { creatorId: call.creatorId }, select: { confirmedBackers: true } });
      return threshold?.confirmedBackers ?? 0;
    }
    case "MISSION_FUNDED": {
      if (!call.missionId) return 0;
      const mission = await prisma.mission.findUnique({ where: { id: call.missionId }, select: { fundedCents: true } });
      return mission?.fundedCents ?? 0;
    }
  }
}

/** Settle one resolved call: winners split the losing pool, largest remainder. */
async function settle(tx: Prisma.TransactionClient, callId: string, outcome: "RESOLVED_YES" | "RESOLVED_NO", value: number) {
  const call = await tx.call.findUniqueOrThrow({
    where: { id: callId },
    include: { stakes: { orderBy: { createdAt: "asc" } }, creator: { select: { displayName: true } } },
  });
  const winningSide: CallSide = outcome === "RESOLVED_YES" ? "YES" : "NO";
  const winners = call.stakes.filter((s) => s.side === winningSide);
  const losers = call.stakes.filter((s) => s.side !== winningSide);
  const winnersPool = winners.reduce((sum, s) => sum + s.points, 0);
  const losersPool = losers.reduce((sum, s) => sum + s.points, 0);

  if (winners.length === 0) {
    // Nobody on the winning side: everyone gets their stake back (no house).
    for (const s of call.stakes) {
      await tx.callStake.update({ where: { id: s.id }, data: { payout: s.points, settled: true } });
      await tx.user.update({ where: { id: s.userId }, data: { points: { increment: s.points } } });
    }
  } else {
    // Largest-remainder split of the losing pool so every point is paid out.
    const shares = winners.map((s) => {
      const exact = (s.points / winnersPool) * losersPool;
      return { s, base: Math.floor(exact), frac: exact - Math.floor(exact) };
    });
    let remainder = losersPool - shares.reduce((sum, w) => sum + w.base, 0);
    shares.sort((a, b) => b.frac - a.frac || a.s.createdAt.getTime() - b.s.createdAt.getTime());
    for (const w of shares) {
      const bonus = remainder > 0 ? 1 : 0;
      remainder -= bonus;
      const payout = w.s.points + w.base + bonus;
      await tx.callStake.update({ where: { id: w.s.id }, data: { payout, settled: true } });
      await tx.user.update({ where: { id: w.s.userId }, data: { points: { increment: payout } } });
      await notify(tx, {
        userId: w.s.userId,
        type: "TASTE_SCORE_UPDATE",
        title: `Called it ✓ ${call.creator.displayName}`,
        body: `"${call.question}" resolved ${winningSide}. ${w.s.points} staked → ${payout} Taste Points.`,
        link: `/calls?win=${callId}`,
      });
    }
    for (const s of losers) {
      await tx.callStake.update({ where: { id: s.id }, data: { payout: 0, settled: true } });
    }
  }

  await tx.call.update({
    where: { id: callId },
    data: { status: outcome, resolvedValue: value, resolvedAt: new Date() },
  });
  publish({
    id: `resolve-${callId}`,
    type: "CALL_RESOLVED",
    message: `Call resolved ${winningSide} on ${call.creator.displayName}: ${call.question}`,
    createdAt: new Date().toISOString(),
    creatorId: call.creatorId,
  });
}

/** Sweep entrypoint: resolve every open call past its deadline. Idempotent. */
export async function resolveDueCalls(now = new Date()): Promise<number> {
  const due = await prisma.call.findMany({ where: { status: "OPEN", deadline: { lte: now } } });
  for (const call of due) {
    const value = await metricValue(call);
    const outcome = value >= call.threshold ? ("RESOLVED_YES" as const) : ("RESOLVED_NO" as const);
    await prisma.$transaction((tx) => settle(tx, call.id, outcome, value));
  }
  return due.length;
}

const CALL_INCLUDE = {
  creator: { select: { handle: true, displayName: true, avatarUrl: true, category: true } },
} satisfies Prisma.CallInclude;

export async function openCalls(limit = 30) {
  return prisma.call.findMany({
    where: { status: "OPEN", deadline: { gt: new Date() } },
    orderBy: { deadline: "asc" },
    take: limit,
    include: CALL_INCLUDE,
  });
}

export async function recentlyResolved(limit = 10) {
  return prisma.call.findMany({
    where: { status: { in: ["RESOLVED_YES", "RESOLVED_NO"] } },
    orderBy: { resolvedAt: "desc" },
    take: limit,
    include: CALL_INCLUDE,
  });
}

export async function callsForCreator(creatorId: string, limit = 4) {
  return prisma.call.findMany({
    where: { creatorId, status: "OPEN", deadline: { gt: new Date() } },
    orderBy: { deadline: "asc" },
    take: limit,
  });
}

export async function stakesFor(userId: string, callIds: string[]) {
  if (callIds.length === 0) return new Map<string, { side: CallSide; points: number }>();
  const rows = await prisma.callStake.findMany({ where: { userId, callId: { in: callIds } } });
  return new Map(rows.map((r) => [r.callId, { side: r.side, points: r.points }]));
}

/** Lifetime record for profiles: wins, losses, net points. */
export async function callRecord(userId: string) {
  const settled = await prisma.callStake.findMany({ where: { userId, settled: true } });
  const won = settled.filter((s) => s.payout > 0);
  return {
    wins: won.length,
    losses: settled.length - won.length,
    netPoints: settled.reduce((sum, s) => sum + s.payout - s.points, 0),
  };
}
