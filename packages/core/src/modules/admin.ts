import { prisma, type ModerationQueue, type ReportReason } from "@famerace/db";
import { config } from "../config";
import { emitEvent } from "../events";
import { DomainError, notFound } from "../errors";
import { assertTransition, audit, CREATOR_TRANSITIONS } from "../statemachine";
import * as auctionMod from "./auction";
import * as backstageMod from "./backstage";
import * as callsMod from "./calls";
import * as demandMod from "./demand";
import * as draftMod from "./draft";
import * as missionsMod from "./missions";
import * as scoresMod from "./scores";
import * as streetteamMod from "./streetteam";

// Admin / Trust & Safety (PRD §9.21, §15.9): queues, takedowns, reports,
// fraud signals, suspensions, sweeps. Every action is audit-logged.

export async function queueCounts() {
  const grouped = await prisma.moderationItem.groupBy({
    by: ["queue"],
    where: { status: "PENDING" },
    _count: true,
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.queue, g._count])) as Partial<
    Record<ModerationQueue, number>
  >;
  const [takedowns, reports, fraud] = await Promise.all([
    prisma.takedownRequest.count({ where: { status: { in: ["RECEIVED", "UNDER_REVIEW"] } } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.fraudSignal.count({ where: { status: "OPEN" } }),
  ]);
  return { ...counts, takedowns, reports, fraud };
}

/** Verification queue with creator context. */
export async function verificationQueue() {
  const items = await prisma.moderationItem.findMany({
    where: { queue: "VERIFICATION", status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  const creators = await prisma.creator.findMany({
    where: { id: { in: items.map((i) => i.objectId) } },
    include: { draftProfile: { select: { fanCount: true, pledgedDemandTotal: true } } },
  });
  return creators;
}

export async function draftQueue() {
  const items = await prisma.moderationItem.findMany({
    where: { queue: "DRAFT_MOD", status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  return prisma.draftProfile.findMany({
    where: { id: { in: items.map((i) => i.objectId) } },
    include: { nominations: { include: { scout: { select: { username: true } } }, take: 3 } },
  });
}

export async function missionQueue() {
  const items = await prisma.moderationItem.findMany({
    where: { queue: "MISSION_REVIEW", status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  return prisma.mission.findMany({
    where: { id: { in: items.map((i) => i.objectId) } },
    include: { creator: { select: { displayName: true, handle: true } } },
  });
}

export async function payoutQueue() {
  return prisma.payout.findMany({
    where: { status: "COMPLIANCE_REVIEW" },
    include: { creator: { select: { displayName: true, handle: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function takedownQueue() {
  return prisma.takedownRequest.findMany({
    where: { status: { in: ["RECEIVED", "UNDER_REVIEW"] } },
    include: { draftProfile: { select: { id: true, nameOrHandle: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Action a takedown (PRD §15.1): ACTIONED removes the draft profile. */
export async function actionTakedown(adminId: string, requestId: string, decision: "ACTIONED" | "REJECTED") {
  return prisma.$transaction(async (tx) => {
    const request = await tx.takedownRequest.findUnique({ where: { id: requestId } });
    if (!request) throw notFound("Takedown request");
    await tx.takedownRequest.update({
      where: { id: requestId },
      data: { status: decision, resolvedByUserId: adminId, resolvedAt: new Date() },
    });
    if (request.draftProfileId) {
      await tx.draftProfile.update({
        where: { id: request.draftProfileId },
        data: { takedownStatus: decision === "ACTIONED" ? "REMOVED" : "NONE" },
      });
    }
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: `TAKEDOWN_${decision}`,
      objectType: "TakedownRequest",
      objectId: requestId,
    });
  });
}

// ── Reports & user safety ──

export async function fileReport(
  reporterUserId: string,
  input: { objectType: string; objectId: string; reason: ReportReason; detail?: string },
) {
  return prisma.report.create({
    data: {
      reporterUserId,
      objectType: input.objectType,
      objectId: input.objectId,
      reason: input.reason,
      detail: input.detail ?? null,
    },
  });
}

export async function openReports() {
  return prisma.report.findMany({
    where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
    include: { reporter: { select: { username: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function resolveReport(adminId: string, reportId: string, decision: "RESOLVED" | "DISMISSED") {
  await prisma.report.update({ where: { id: reportId }, data: { status: decision } });
  await audit(prisma, {
    actorId: adminId,
    actorType: "ADMIN",
    action: `REPORT_${decision}`,
    objectType: "Report",
    objectId: reportId,
  });
}

export async function suspendCreator(adminId: string, creatorId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findUnique({ where: { id: creatorId }, include: { market: true } });
    if (!creator) throw notFound("Creator");
    assertTransition("creator", CREATOR_TRANSITIONS, creator.status, "SUSPENDED");
    await tx.creator.update({ where: { id: creatorId }, data: { status: "SUSPENDED" } });
    if (creator.market && ["GENESIS_CURVE", "GRADUATION", "MATURE"].includes(creator.market.status)) {
      await tx.creatorMarket.update({
        where: { id: creator.market.id },
        data: { status: "PAUSED", pausedReason: `Creator suspended: ${reason}` },
      });
    }
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: "CREATOR_SUSPENDED",
      objectType: "Creator",
      objectId: creatorId,
      after: { reason },
    });
  });
}

export async function suspendUser(adminId: string, userId: string, reason: string) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound("User");
  if (target.roles.includes("ADMIN")) throw new DomainError("FORBIDDEN", "Cannot suspend an admin", 403);
  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  await prisma.session.deleteMany({ where: { userId } });
  await audit(prisma, {
    actorId: adminId,
    actorType: "ADMIN",
    action: "USER_SUSPENDED",
    objectType: "User",
    objectId: userId,
    after: { reason },
  });
}

// ── Fraud detection (PRD §22.5) ──

/**
 * Wash-trading heuristic: users with ≥3 buy/sell round-trips in a market
 * within 24h get an open FraudSignal. Coarse by design — signals feed human
 * review, they do not auto-punish.
 */
export async function detectWashTrading(): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const trades = await prisma.marketTransaction.findMany({
    where: { createdAt: { gte: since } },
    select: { creatorMarketId: true, userId: true, side: true },
  });
  const byUserMarket = new Map<string, { buys: number; sells: number }>();
  for (const trade of trades) {
    const key = `${trade.userId}:${trade.creatorMarketId}`;
    const entry = byUserMarket.get(key) ?? { buys: 0, sells: 0 };
    if (trade.side === "BUY") entry.buys += 1;
    else entry.sells += 1;
    byUserMarket.set(key, entry);
  }
  let flagged = 0;
  for (const [key, entry] of byUserMarket) {
    const roundTrips = Math.min(entry.buys, entry.sells);
    if (roundTrips >= 3) {
      const [userId, marketId] = key.split(":");
      await prisma.fraudSignal.upsert({
        where: { id: `wash_${key}_${since.toDateString()}` },
        create: {
          id: `wash_${key}_${since.toDateString()}`,
          objectType: "CreatorMarket",
          objectId: marketId ?? "",
          signal: "WASH_TRADING",
          score: Math.min(1, roundTrips / 10),
          metadata: { userId, roundTrips },
        },
        update: { score: Math.min(1, roundTrips / 10), metadata: { userId, roundTrips } },
      });
      flagged += 1;
    }
  }
  return flagged;
}

export async function openFraudSignals() {
  return prisma.fraudSignal.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" } });
}

export async function resolveFraudSignal(adminId: string, signalId: string, decision: "CONFIRMED" | "DISMISSED") {
  await prisma.fraudSignal.update({ where: { id: signalId }, data: { status: decision } });
  await audit(prisma, {
    actorId: adminId,
    actorType: "ADMIN",
    action: `FRAUD_${decision}`,
    objectType: "FraudSignal",
    objectId: signalId,
  });
}

export async function recentAuditLog(limit = 50) {
  return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

/** GRADUATION → MATURE once the tier-2 thresholds clear (PRD §9.6 stages). */
export async function matureGraduatedMarkets(): Promise<number> {
  const graduated = await prisma.creatorMarket.findMany({
    where: {
      status: "GRADUATION",
      volumeTotalCents: { gte: BigInt(config.graduation.matureVolumeCents) },
      holderCount: { gte: config.graduation.matureHolderCount },
    },
    include: { creator: { select: { displayName: true } } },
  });
  for (const market of graduated) {
    await prisma.$transaction(async (tx) => {
      await tx.creatorMarket.update({ where: { id: market.id }, data: { status: "MATURE" } });
      await emitEvent(tx, {
        type: "CREATOR_MILESTONE",
        creatorId: market.creatorId,
        message: `$${market.ticker} is now a mature market — ${market.creator.displayName} joined the big board`,
      });
    });
  }
  return graduated.length;
}

/** All periodic jobs in one sweep — the admin button and the cron entrypoint. */
export async function runSweeps() {
  const [settled, expiredOrders, expiredMissions, memberships, crews, taste, fame, wash, rankChanges, matured, callsResolved, callsOpened] =
    await Promise.all([
      auctionMod.settleDueLaunches(),
      demandMod.expireStaleOrders(),
      missionsMod.expireMissions(),
      backstageMod.sweepMemberships(),
      streetteamMod.rankCrews(),
      scoresMod.computeAllTasteScores(),
      scoresMod.computeAllFameScores(),
      detectWashTrading(),
      draftMod.snapshotDraftRanks(),
      matureGraduatedMarkets(),
      callsMod.resolveDueCalls(),
      callsMod.ensureAutoCalls(),
    ]);
  return { settled, expiredOrders, expiredMissions, memberships, crews, taste, fame, wash, rankChanges, matured, callsResolved, callsOpened };
}
