import { prisma, type Creator, type Prisma, type ThresholdStatus } from "@famerace/db";
import { z } from "zod";
import { config } from "../config";
import { DomainError, notFound } from "../errors";
import { emitEvent } from "../events";
import { assertTransition, audit, CREATOR_TRANSITIONS } from "../statemachine";
import { postLedgerTx } from "./ledger";

// Creator Claim Flow (PRD §9.2, §7.1) and Launch Threshold Engine (§9A.4).
// Claim → verify → approve → configure → threshold → schedule launch.

/** Ticker from handle: "mira_music" → "MIRA", unique-ified with a digit suffix. */
async function generateTicker(tx: Prisma.TransactionClient, handle: string): Promise<string> {
  const base = handle.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6) || "STAR";
  let candidate = base;
  for (let i = 2; i < 100; i += 1) {
    const existing = await tx.creatorMarket.findUnique({ where: { ticker: candidate } });
    if (!existing) return candidate;
    candidate = `${base.slice(0, 5)}${i}`;
  }
  throw new DomainError("TICKER_EXHAUSTED", "Could not generate a unique ticker", 500);
}

/**
 * Step 1 — the person behind a draft profile starts the claim.
 * Creates the Creator record (status CLAIM_STARTED) linked to the draft.
 */
export async function startClaim(userId: string, draftProfileId: string): Promise<Creator> {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.draftProfile.findUnique({
      where: { id: draftProfileId },
      include: { claimedCreator: true },
    });
    if (!profile) throw notFound("Draft profile");
    if (profile.claimedCreator) throw new DomainError("ALREADY_CLAIMED", "This profile is already claimed");
    if (profile.takedownStatus === "REMOVED") throw notFound("Draft profile");

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { roles: true } });
    const existing = await tx.creator.findFirst({ where: { userId } });
    if (existing) throw new DomainError("ONE_CREATOR", "You already have a creator profile");

    const creator = await tx.creator.create({
      data: {
        userId,
        draftProfileId,
        displayName: profile.nameOrHandle,
        handle: profile.normalizedHandle,
        category: profile.category,
        status: "CLAIM_STARTED",
      },
    });
    await tx.draftProfile.update({
      where: { id: draftProfileId },
      data: { claimStatus: "CLAIM_STARTED" },
    });
    if (!user.roles.includes("CREATOR")) {
      await tx.user.update({ where: { id: userId }, data: { roles: [...user.roles, "CREATOR"] } });
    }
    await audit(tx, {
      actorId: userId,
      action: "CLAIM_STARTED",
      objectType: "Creator",
      objectId: creator.id,
    });
    return creator;
  });
}

export const verificationSchema = z.object({
  bio: z.string().min(10).max(500),
  story: z.string().min(20).max(3000),
  socialLinks: z.array(z.string().url()).min(1, "Add at least one social link").max(6),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the creator terms and disclosures" }),
  }),
});

/** Step 2 — creator submits identity/social evidence for review (KYC hook). */
export async function submitVerification(
  userId: string,
  creatorId: string,
  input: z.infer<typeof verificationSchema>,
): Promise<Creator> {
  const data = verificationSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findUnique({ where: { id: creatorId } });
    if (!creator || creator.userId !== userId) throw notFound("Creator profile");
    assertTransition("creator", CREATOR_TRANSITIONS, creator.status, "VERIFICATION_PENDING");

    const updated = await tx.creator.update({
      where: { id: creatorId },
      data: {
        bio: data.bio,
        story: data.story,
        socialLinks: data.socialLinks,
        status: "VERIFICATION_PENDING",
        verificationStatus: "PENDING",
        termsAcceptedAt: new Date(),
      },
    });
    await tx.moderationItem.upsert({
      where: {
        objectType_objectId_queue: {
          objectType: "Creator",
          objectId: creatorId,
          queue: "VERIFICATION",
        },
      },
      create: { objectType: "Creator", objectId: creatorId, queue: "VERIFICATION" },
      update: { status: "PENDING" },
    });
    await audit(tx, {
      actorId: userId,
      action: "VERIFICATION_SUBMITTED",
      objectType: "Creator",
      objectId: creatorId,
    });
    return updated;
  });
}

/**
 * Step 3 — admin approves verification (PRD §9.2). Creates the launch
 * threshold, the pre-launch market shell, moves draft demand onto the
 * creator, marks the draft claimed and pays the claim bounty to the scout.
 */
export async function approveVerification(adminId: string, creatorId: string): Promise<Creator> {
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findUnique({
      where: { id: creatorId },
      include: { draftProfile: { include: { claimBounty: true, nominations: true } } },
    });
    if (!creator) throw notFound("Creator profile");
    assertTransition("creator", CREATOR_TRANSITIONS, creator.status, "APPROVED");

    const updated = await tx.creator.update({
      where: { id: creatorId },
      data: {
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        safetyApproved: true,
        approvedAt: new Date(),
      },
    });

    await tx.launchThreshold.upsert({
      where: { creatorId },
      create: {
        creatorId,
        requiredBackers: config.season.requiredBackers,
        requiredDemandCents: config.season.requiredDemandCents,
        requiredPerksCount: config.season.requiredPerksCount,
        creatorVerified: true,
        safetyApproved: true,
      },
      update: { creatorVerified: true, safetyApproved: true },
    });

    const ticker = await generateTicker(tx, creator.handle);
    await tx.creatorMarket.upsert({
      where: { creatorId },
      create: {
        creatorId,
        ticker,
        creatorFeeBps: config.fees.creatorFeeBps,
        protocolFeeBps: config.fees.protocolFeeBps,
        scoutFeeBps: config.fees.scoutFeeBps,
      },
      update: {},
    });

    if (creator.draftProfile) {
      const draftProfile = creator.draftProfile;
      await tx.draftProfile.update({
        where: { id: draftProfile.id },
        data: { claimStatus: "CLAIMED" },
      });
      // Demand follows the creator (PRD §9A.3 creator_id_if_claimed).
      await tx.fanDemandOrder.updateMany({
        where: { draftProfileId: draftProfile.id, refundStatus: "NONE" },
        data: { creatorId },
      });
      // Claim bounty payout to the first valid nominator (PRD §9A.6).
      const bounty = draftProfile.claimBounty;
      const firstScout = draftProfile.nominations.find((n) => n.status === "APPROVED");
      if (bounty && bounty.status === "OPEN" && firstScout) {
        await tx.claimBounty.update({
          where: { id: bounty.id },
          data: { status: "PAID", paidToUserId: firstScout.scoutUserId, paidAt: new Date() },
        });
        await postLedgerTx(
          tx,
          "FEE",
          [
            { account: "EXTERNAL", deltaCents: -bounty.amountCents },
            { account: "SCOUT_REWARDS", deltaCents: bounty.amountCents, userId: firstScout.scoutUserId },
          ],
          { kind: "claim_bounty", bountyId: bounty.id, draftProfileId: draftProfile.id },
        );
        await tx.userBadge.create({
          data: {
            userId: firstScout.scoutUserId,
            badgeType: "GENESIS_SCOUT",
            label: `Discovered ${creator.displayName} before FameRace`,
            sourceRef: creatorId,
          },
        });
        await tx.scoutNomination.update({
          where: { id: firstScout.id },
          data: { claimResult: "CLAIMED" },
        });
        await tx.notification.create({
          data: {
            userId: firstScout.scoutUserId,
            type: "CREATOR_CLAIMED",
            title: `${creator.displayName} claimed their launch`,
            body: `Your scout bounty unlocked. Genesis Scout status is yours forever.`,
            link: `/c/${creator.handle}`,
          },
        });
      }
    }

    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: "VERIFICATION_APPROVED",
      objectType: "Creator",
      objectId: creatorId,
    });
    await emitEvent(tx, {
      type: "CREATOR_CLAIMED",
      creatorId,
      draftProfileId: creator.draftProfileId,
      message: `${creator.displayName} claimed their FameRace launch`,
    });
    await recomputeThresholdInTx(tx, creatorId);
    return updated;
  });
}

export async function rejectVerification(adminId: string, creatorId: string, notes?: string) {
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw notFound("Creator profile");
    assertTransition("creator", CREATOR_TRANSITIONS, creator.status, "CLAIM_STARTED");
    await tx.creator.update({
      where: { id: creatorId },
      data: { status: "CLAIM_STARTED", verificationStatus: "REJECTED" },
    });
    await tx.moderationItem.updateMany({
      where: { objectType: "Creator", objectId: creatorId, queue: "VERIFICATION" },
      data: { status: "REJECTED", assigneeUserId: adminId, notes },
    });
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: "VERIFICATION_REJECTED",
      objectType: "Creator",
      objectId: creatorId,
    });
  });
}

export const perksSchema = z.object({
  perks: z.array(z.string().min(3).max(200)).min(3, "Configure at least 3 backer perks").max(8),
});

/** Creator configures launch perks (part of the §0A.5 gate). */
export async function configurePerks(userId: string, creatorId: string, input: z.infer<typeof perksSchema>) {
  const data = perksSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findUnique({ where: { id: creatorId } });
    if (!creator || creator.userId !== userId) throw notFound("Creator profile");
    await tx.creator.update({ where: { id: creatorId }, data: { perks: data.perks } });
    await audit(tx, { actorId: userId, action: "PERKS_CONFIGURED", objectType: "Creator", objectId: creatorId });
    await recomputeThresholdInTx(tx, creatorId);
  });
}

/** Dev-rail payout setup; a real provider would run KYC/bank onboarding here. */
export async function configurePayout(userId: string, creatorId: string) {
  await prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findUnique({ where: { id: creatorId } });
    if (!creator || creator.userId !== userId) throw notFound("Creator profile");
    await tx.creator.update({ where: { id: creatorId }, data: { payoutStatus: "ACTIVE" } });
    await audit(tx, { actorId: userId, action: "PAYOUT_CONFIGURED", objectType: "Creator", objectId: creatorId });
  });
}

/** Admin approves the launch kit (PRD §9.18 — required by the gate). */
export async function approveLaunchKit(adminId: string, creatorId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.creator.update({ where: { id: creatorId }, data: { launchKitApproved: true } });
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: "LAUNCH_KIT_APPROVED",
      objectType: "Creator",
      objectId: creatorId,
    });
    await recomputeThresholdInTx(tx, creatorId);
  });
}

// ── Launch Threshold Engine (PRD §9A.4, §0A.5) ──

function statusFor(t: {
  creatorVerified: boolean;
  safetyApproved: boolean;
  launchKitApproved: boolean;
  missionConfigured: boolean;
  perksConfigured: boolean;
  confirmedBackers: number;
  confirmedDemandCents: number;
  requiredBackers: number;
  requiredDemandCents: number;
}): ThresholdStatus {
  const gates = [
    t.creatorVerified,
    t.safetyApproved,
    t.launchKitApproved,
    t.missionConfigured,
    t.perksConfigured,
    t.confirmedBackers >= t.requiredBackers,
    t.confirmedDemandCents >= t.requiredDemandCents,
  ];
  const met = gates.filter(Boolean).length;
  if (met === gates.length) return "THRESHOLD_MET";
  if (met >= gates.length - 2) return "ALMOST_READY";
  return "NOT_READY";
}

export async function recomputeThreshold(creatorId: string) {
  return prisma.$transaction(async (tx) => recomputeThresholdInTx(tx, creatorId));
}

export async function recomputeThresholdInTx(tx: Prisma.TransactionClient, creatorId: string) {
  const threshold = await tx.launchThreshold.findUnique({ where: { creatorId } });
  if (!threshold) return null; // threshold exists only after verification approval
  if (threshold.status === "LAUNCHING_SOON" || threshold.status === "LIVE") return threshold;

  const creator = await tx.creator.findUniqueOrThrow({ where: { id: creatorId } });
  const demand = await tx.fanDemandOrder.findMany({
    where: {
      creatorId,
      bindingStatus: { in: ["REFUNDABLE_PLEDGE", "PRE_AUTHORIZED"] },
      confirmationStatus: { not: "DECLINED" },
      refundStatus: "NONE",
      expiresAt: { gt: new Date() },
    },
    select: { userId: true, amountCents: true },
  });
  const missionCount = await tx.mission.count({
    where: { creatorId, status: { in: ["UNDER_REVIEW", "LIVE"] } },
  });
  const perks = Array.isArray(creator.perks) ? creator.perks.length : 0;

  const next = {
    creatorVerified: creator.verificationStatus === "VERIFIED",
    safetyApproved: creator.safetyApproved,
    launchKitApproved: creator.launchKitApproved,
    missionConfigured: missionCount > 0,
    perksConfigured: perks >= threshold.requiredPerksCount,
    confirmedBackers: new Set(demand.map((d) => d.userId)).size,
    confirmedDemandCents: demand.reduce((sum, d) => sum + d.amountCents, 0),
    requiredBackers: threshold.requiredBackers,
    requiredDemandCents: threshold.requiredDemandCents,
  };
  const status = statusFor(next);

  const updated = await tx.launchThreshold.update({
    where: { creatorId },
    data: { ...next, requiredBackers: undefined, requiredDemandCents: undefined, status },
  });

  if (status === "THRESHOLD_MET" && threshold.status !== "THRESHOLD_MET") {
    await emitEvent(tx, {
      type: "THRESHOLD_MET",
      creatorId,
      message: `${creator.displayName} hit the launch threshold — launch can be scheduled`,
    });
  }
  return updated;
}

/**
 * Step 4 — schedule the launch (PRD §0A.4). Requires THRESHOLD_MET.
 * Opens the confirmation window and creates the opening auction.
 */
export async function scheduleLaunch(adminId: string, creatorId: string, launchAt: Date) {
  if (launchAt.getTime() <= Date.now()) {
    throw new DomainError("BAD_LAUNCH_TIME", "Launch time must be in the future");
  }
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findUnique({
      where: { id: creatorId },
      include: { launchThreshold: true, market: true },
    });
    if (!creator || !creator.market) throw notFound("Creator profile");
    if (creator.launchThreshold?.status !== "THRESHOLD_MET") {
      throw new DomainError("THRESHOLD_NOT_MET", "Launch threshold not met — no dead markets (PRD §0A.5)");
    }
    assertTransition("creator", CREATOR_TRANSITIONS, creator.status, "LAUNCHING_SOON");

    await tx.creator.update({
      where: { id: creatorId },
      data: { status: "LAUNCHING_SOON", launchAt },
    });
    await tx.launchThreshold.update({
      where: { creatorId },
      data: { status: "LAUNCHING_SOON" },
    });
    await tx.openingAuction.upsert({
      where: { creatorMarketId: creator.market.id },
      create: {
        creatorMarketId: creator.market.id,
        startTime: new Date(launchAt.getTime() - config.confirmationWindowHours * 3600 * 1000),
        endTime: launchAt,
        status: "COLLECTING",
      },
      update: {
        startTime: new Date(launchAt.getTime() - config.confirmationWindowHours * 3600 * 1000),
        endTime: launchAt,
        status: "COLLECTING",
      },
    });
    // Confirmation window opens for all existing demand orders.
    await tx.fanDemandOrder.updateMany({
      where: {
        creatorId,
        confirmationStatus: "UNCONFIRMED",
        refundStatus: "NONE",
        expiresAt: { gt: new Date() },
      },
      data: { confirmationStatus: "CONFIRMATION_WINDOW" },
    });
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: "LAUNCH_SCHEDULED",
      objectType: "Creator",
      objectId: creatorId,
      after: { launchAt: launchAt.toISOString() },
    });
    await emitEvent(tx, {
      type: "LAUNCH_SCHEDULED",
      creatorId,
      message: `${creator.displayName} is launching soon — confirmation window open`,
    });
  });
}

/** Creator + launch state for the dashboard checklist. */
export async function creatorForUser(userId: string) {
  return prisma.creator.findFirst({
    where: { userId },
    include: {
      launchThreshold: true,
      market: { include: { auction: true } },
      draftProfile: { select: { id: true, fanCount: true, pledgedDemandTotal: true } },
      missions: { orderBy: { createdAt: "desc" } },
    },
  });
}
