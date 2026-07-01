import { prisma, type Mission, type Prisma } from "@famerace/db";
import { z } from "zod";
import { config } from "../config";
import { DomainError, notFound } from "../errors";
import { emitEvent } from "../events";
import { paymentProvider } from "../payments";
import { assertTransition, audit, MISSION_TRANSITIONS } from "../statemachine";
import { recomputeThresholdInTx } from "./claim";
import { postLedgerTx } from "./ledger";

// Missions (PRD §4.3, §9.12): fund a concrete career move. Contributions
// escrow in MISSION_ESCROW; escrow releases to the creator (minus the
// platform fee) when work starts; ALL_OR_NOTHING missions refund on expiry.

export const missionSchema = z.object({
  title: z.string().min(4).max(120),
  goalCents: z.number().int().min(10_000, "Minimum goal is $100").max(100_000_000),
  deadlineDays: z.number().int().min(3).max(90),
  useOfFunds: z.string().min(10).max(2000),
  rewardTiers: z
    .array(z.object({ thresholdCents: z.number().int().min(100), reward: z.string().min(3).max(200) }))
    .max(8)
    .default([]),
  proofRequirements: z.string().max(1000).optional().or(z.literal("")),
  refundRule: z.enum(["ALL_OR_NOTHING", "KEEP_WHAT_RAISED"]).default("ALL_OR_NOTHING"),
});

export async function createMission(userId: string, input: z.infer<typeof missionSchema>) {
  const data = missionSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findFirst({ where: { userId } });
    if (!creator) throw notFound("Creator profile");
    const mission = await tx.mission.create({
      data: {
        creatorId: creator.id,
        title: data.title,
        goalCents: data.goalCents,
        deadline: new Date(Date.now() + data.deadlineDays * 86_400_000),
        useOfFunds: data.useOfFunds,
        rewardTiers: data.rewardTiers,
        proofRequirements: data.proofRequirements || null,
        refundRule: data.refundRule,
        status: "UNDER_REVIEW",
      },
    });
    await tx.moderationItem.create({
      data: { objectType: "Mission", objectId: mission.id, queue: "MISSION_REVIEW" },
    });
    await audit(tx, { actorId: userId, action: "MISSION_CREATED", objectType: "Mission", objectId: mission.id });
    await recomputeThresholdInTx(tx, creator.id);
    return mission;
  });
}

/** Admin review → LIVE. Converts waiting MISSION_PLEDGE demand orders. */
export async function approveMission(adminId: string, missionId: string) {
  return prisma.$transaction(async (tx) => {
    const mission = await tx.mission.findUnique({
      where: { id: missionId },
      include: { creator: true },
    });
    if (!mission) throw notFound("Mission");
    assertTransition("mission", MISSION_TRANSITIONS, mission.status, "LIVE");
    await tx.mission.update({ where: { id: missionId }, data: { status: "LIVE" } });
    await tx.moderationItem.updateMany({
      where: { objectType: "Mission", objectId: missionId, queue: "MISSION_REVIEW" },
      data: { status: "APPROVED", assigneeUserId: adminId },
    });
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: "MISSION_APPROVED",
      objectType: "Mission",
      objectId: missionId,
    });
    await emitEvent(tx, {
      type: "MISSION_LAUNCHED",
      creatorId: mission.creatorId,
      message: `${mission.creator.displayName} launched a mission: ${mission.title}`,
    });

    // Convert authorized MISSION_PLEDGE orders (creator LIVE only — money
    // still never moves before the creator's official launch, §0A.3).
    if (mission.creator.status === "LIVE") {
      const pledges = await tx.fanDemandOrder.findMany({
        where: {
          creatorId: mission.creatorId,
          intentType: "MISSION_PLEDGE",
          paymentAuthStatus: "AUTHORIZED",
          refundStatus: "NONE",
        },
      });
      for (const pledge of pledges) {
        await paymentProvider.capture(pledge.paymentAuthRef ?? "");
        await tx.fanDemandOrder.update({
          where: { id: pledge.id },
          data: { paymentAuthStatus: "CAPTURED", confirmationStatus: "CONFIRMED" },
        });
        await contributeInTx(tx, pledge.userId, mission.id, pledge.amountCents, "Demand Vault pledge");
      }
    }
    return tx.mission.findUniqueOrThrow({ where: { id: missionId } });
  });
}

export async function contribute(
  userId: string,
  missionId: string,
  amountCents: number,
  tierLabel?: string,
) {
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw new DomainError("BAD_AMOUNT", "Minimum contribution is $1");
  }
  const auth = await paymentProvider.authorize({ userId, amountCents, purpose: "mission" });
  await paymentProvider.capture(auth.authRef);
  return prisma.$transaction(async (tx) => contributeInTx(tx, userId, missionId, amountCents, tierLabel));
}

async function contributeInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  missionId: string,
  amountCents: number,
  tierLabel?: string,
) {
  const mission = await tx.mission.findUnique({ where: { id: missionId }, include: { creator: true } });
  if (!mission) throw notFound("Mission");
  if (mission.status !== "LIVE") throw new DomainError("MISSION_NOT_LIVE", "This mission is not accepting contributions");
  if (mission.deadline < new Date()) throw new DomainError("MISSION_EXPIRED", "This mission's deadline has passed");

  // Match Fund (PRD §0A.17/§9A.10): active season fund matches at its ratio
  // within the per-creator cap; match money escrows alongside the contribution.
  let matchCents = 0;
  if (mission.matchEligible) {
    const fund = await tx.matchFund.findFirst({ where: { active: true } });
    if (fund) {
      const room = Math.min(
        fund.totalCents - fund.spentCents,
        Math.max(0, (mission.matchCapCents || fund.creatorCap) - mission.matchCents),
      );
      matchCents = Math.min(Math.floor(amountCents * fund.matchRatio), room);
      if (matchCents > 0) {
        await tx.matchFund.update({
          where: { id: fund.id },
          data: { spentCents: { increment: matchCents } },
        });
      }
    }
  }

  const ledgerTxId = await postLedgerTx(
    tx,
    "MISSION_CONTRIBUTION",
    [
      { account: "EXTERNAL", deltaCents: -amountCents, userId },
      ...(matchCents > 0 ? [{ account: "MATCH_FUND" as const, deltaCents: -matchCents }] : []),
      { account: "MISSION_ESCROW", deltaCents: amountCents + matchCents, missionId, creatorId: mission.creatorId },
    ],
    { kind: "mission_contribution", missionId, matchCents },
  );
  const contribution = await tx.missionContribution.create({
    data: { missionId, userId, amountCents, matchCents, tierLabel: tierLabel ?? null, ledgerTxId },
  });
  const funded = mission.fundedCents + amountCents + matchCents;
  await tx.mission.update({
    where: { id: missionId },
    data: { fundedCents: funded, matchCents: { increment: matchCents } },
  });
  await emitEvent(tx, {
    type: "MISSION_CONTRIBUTION",
    actorId: userId,
    creatorId: mission.creatorId,
    message: `${mission.creator.displayName}'s mission "${mission.title}" is ${Math.min(
      100,
      Math.round((funded / mission.goalCents) * 100),
    )}% funded`,
  });

  if (funded >= mission.goalCents) {
    assertTransition("mission", MISSION_TRANSITIONS, "LIVE", "FUNDED");
    await tx.mission.update({ where: { id: missionId }, data: { status: "FUNDED" } });
    await emitEvent(tx, {
      type: "MISSION_FUNDED",
      creatorId: mission.creatorId,
      message: `FUNDED: ${mission.creator.displayName} — ${mission.title}`,
    });
    const backers = await tx.missionContribution.findMany({
      where: { missionId },
      select: { userId: true },
      distinct: ["userId"],
    });
    for (const backer of backers) {
      await tx.userBadge.create({
        data: {
          userId: backer.userId,
          badgeType: "MISSION_BACKER",
          label: `Helped fund: ${mission.title}`,
          sourceRef: missionId,
        },
      });
      await tx.notification.create({
        data: {
          userId: backer.userId,
          type: "MISSION_FUNDED",
          title: `Mission funded: ${mission.title}`,
          body: "You helped make it happen. Permanent proof is on your profile.",
          link: `/c/${mission.creator.handle}`,
        },
      });
    }
    if (mission.creator.userId) {
      await tx.notification.create({
        data: {
          userId: mission.creator.userId,
          type: "MISSION_FUNDED",
          title: `Your mission "${mission.title}" is fully funded`,
          body: "Start the work to release escrow to your balance.",
          link: "/dashboard/missions",
        },
      });
    }
  }
  return contribution;
}

/** FUNDED → IN_PROGRESS: escrow releases to the creator minus platform fee. */
export async function startWork(userId: string, missionId: string) {
  return prisma.$transaction(async (tx) => {
    const mission = await tx.mission.findUnique({ where: { id: missionId }, include: { creator: true } });
    if (!mission || mission.creator.userId !== userId) throw notFound("Mission");
    assertTransition("mission", MISSION_TRANSITIONS, mission.status, "IN_PROGRESS");

    const escrow = mission.fundedCents;
    const feeCents = Math.floor((escrow * config.mission.platformFeeBps) / 10_000);
    await postLedgerTx(
      tx,
      "MISSION_ESCROW_RELEASE",
      [
        { account: "MISSION_ESCROW", deltaCents: -escrow, missionId, creatorId: mission.creatorId },
        { account: "CREATOR_EARNED", deltaCents: escrow - feeCents, creatorId: mission.creatorId },
        { account: "PLATFORM_FEES", deltaCents: feeCents },
      ],
      { kind: "mission_release", missionId },
    );
    await tx.mission.update({ where: { id: missionId }, data: { status: "IN_PROGRESS" } });
    await audit(tx, { actorId: userId, action: "MISSION_STARTED", objectType: "Mission", objectId: missionId });
    return tx.mission.findUniqueOrThrow({ where: { id: missionId } });
  });
}

export const updateSchema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(3000),
  proofUrl: z.string().url().max(300).optional().or(z.literal("")),
});

export async function postUpdate(userId: string, missionId: string, input: z.infer<typeof updateSchema>) {
  const data = updateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const mission = await tx.mission.findUnique({ where: { id: missionId }, include: { creator: true } });
    if (!mission || mission.creator.userId !== userId) throw notFound("Mission");
    return tx.missionUpdate.create({
      data: { missionId, title: data.title, body: data.body, proofUrl: data.proofUrl || null },
    });
  });
}

/** IN_PROGRESS → COMPLETED (requires at least one proof update). */
export async function completeMission(userId: string, missionId: string) {
  return prisma.$transaction(async (tx) => {
    const mission = await tx.mission.findUnique({ where: { id: missionId }, include: { creator: true } });
    if (!mission || mission.creator.userId !== userId) throw notFound("Mission");
    assertTransition("mission", MISSION_TRANSITIONS, mission.status, "COMPLETED");
    const proofCount = await tx.missionUpdate.count({ where: { missionId, proofUrl: { not: null } } });
    if (proofCount === 0) {
      throw new DomainError("PROOF_REQUIRED", "Post at least one update with proof before completing");
    }
    await tx.mission.update({ where: { id: missionId }, data: { status: "COMPLETED" } });
    await emitEvent(tx, {
      type: "MISSION_COMPLETED",
      creatorId: mission.creatorId,
      message: `${mission.creator.displayName} completed the mission "${mission.title}" — fans funded this`,
    });
    await audit(tx, { actorId: userId, action: "MISSION_COMPLETED", objectType: "Mission", objectId: missionId });
    return tx.mission.findUniqueOrThrow({ where: { id: missionId } });
  });
}

/** Deadline sweep: LIVE past deadline → PARTIALLY_FUNDED / EXPIRED (+refunds). */
export async function expireMissions(now = new Date()): Promise<number> {
  const due = await prisma.mission.findMany({
    where: { status: "LIVE", deadline: { lte: now } },
    select: { id: true },
  });
  for (const { id } of due) {
    await prisma.$transaction(async (tx) => {
      const mission = await tx.mission.findUniqueOrThrow({ where: { id }, include: { creator: true } });
      if (mission.fundedCents === 0) {
        assertTransition("mission", MISSION_TRANSITIONS, mission.status, "EXPIRED");
        await tx.mission.update({ where: { id }, data: { status: "EXPIRED" } });
        return;
      }
      if (mission.refundRule === "KEEP_WHAT_RAISED") {
        assertTransition("mission", MISSION_TRANSITIONS, mission.status, "PARTIALLY_FUNDED");
        await tx.mission.update({ where: { id }, data: { status: "PARTIALLY_FUNDED" } });
        return;
      }
      // ALL_OR_NOTHING: refund every contribution from escrow.
      assertTransition("mission", MISSION_TRANSITIONS, mission.status, "EXPIRED");
      const contributions = await tx.missionContribution.findMany({ where: { missionId: id, refunded: false } });
      for (const contribution of contributions) {
        await postLedgerTx(
          tx,
          "REFUND",
          [
            {
              account: "MISSION_ESCROW",
              deltaCents: -(contribution.amountCents + contribution.matchCents),
              missionId: id,
              creatorId: mission.creatorId,
            },
            { account: "EXTERNAL", deltaCents: contribution.amountCents, userId: contribution.userId },
            ...(contribution.matchCents > 0
              ? [{ account: "MATCH_FUND" as const, deltaCents: contribution.matchCents }]
              : []),
          ],
          { kind: "mission_refund", missionId: id, contributionId: contribution.id },
        );
        await tx.missionContribution.update({ where: { id: contribution.id }, data: { refunded: true } });
      }
      // Returned match budget is spendable again.
      const matchReturned = contributions.reduce((sum, c) => sum + c.matchCents, 0);
      if (matchReturned > 0) {
        await tx.matchFund.updateMany({
          where: { active: true },
          data: { spentCents: { decrement: matchReturned } },
        });
      }
      await tx.mission.update({ where: { id }, data: { status: "EXPIRED", fundedCents: 0, matchCents: 0 } });
      await audit(tx, {
        actorType: "SYSTEM",
        action: "MISSION_EXPIRED_REFUNDED",
        objectType: "Mission",
        objectId: id,
      });
    });
  }
  return due.length;
}

export async function missionsNearFunding(limit = 12): Promise<(Mission & { creator: { handle: string; displayName: string } })[]> {
  const missions = await prisma.mission.findMany({
    where: { status: "LIVE", deadline: { gt: new Date() } },
    include: { creator: { select: { handle: true, displayName: true } } },
    take: 100,
  });
  return missions
    .sort((a, b) => b.fundedCents / b.goalCents - a.fundedCents / a.goalCents)
    .slice(0, limit);
}

export async function missionDetail(missionId: string) {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: {
      creator: { select: { id: true, handle: true, displayName: true, status: true } },
      updates: { orderBy: { createdAt: "desc" } },
      contributions: {
        orderBy: { amountCents: "desc" },
        take: 10,
        include: { user: { select: { username: true } } },
      },
    },
  });
  if (!mission) throw notFound("Mission");
  return mission;
}
