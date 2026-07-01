import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as claimMod from "../src/modules/claim";
import * as demandMod from "../src/modules/demand";
import * as draftMod from "../src/modules/draft";
import { balance, assertLedgerBalanced } from "../src/modules/ledger";
import { makeUser, resetDb } from "./helpers";

/** Full pre-launch pipeline: nominate → approve → pledge → claim → verify →
 *  approve → configure → threshold met → schedule launch. */
async function setupApprovedDraft() {
  const [scout, admin, fan1, fan2, mira] = await Promise.all([
    makeUser(),
    makeUser({ roles: ["ADMIN"] }),
    makeUser(),
    makeUser(),
    makeUser({ username: "mira_irl" }),
  ]);
  const { profile } = await draftMod.nominate(scout.id, {
    nameOrHandle: "MIRA",
    category: "MUSICIAN",
    thesis: "Indie singer with insane hooks, about to break out.",
    requestedMission: "First Music Video",
  });
  await draftMod.moderateDraft(admin.id, profile.id, "APPROVED");
  return { scout, admin, fan1, fan2, mira, profile };
}

describe("demand vault", () => {
  beforeEach(resetDb);

  it("collects refundable pledges and updates the vault total", async () => {
    const { fan1, fan2, profile } = await setupApprovedDraft();
    await demandMod.placeDemandOrder(fan1.id, {
      draftProfileId: profile.id,
      intentType: "GENESIS_PASS",
      amountCents: 10_000,
      binding: true,
    });
    await demandMod.placeDemandOrder(fan2.id, {
      draftProfileId: profile.id,
      intentType: "MISSION_PLEDGE",
      amountCents: 15_000,
      binding: true,
    });
    const after = await prisma.draftProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(after.pledgedDemandTotal).toBe(25_000);
    expect(after.fanCount).toBe(2); // pledgers join the fan count

    const summary = await demandMod.demandSummary({ draftProfileId: profile.id });
    expect(summary.backerCount).toBe(2);
    expect(summary.byIntent.GENESIS_PASS).toBe(10_000);
  });

  it("cancelling a pledge releases the hold and recomputes demand", async () => {
    const { fan1, profile } = await setupApprovedDraft();
    const order = await demandMod.placeDemandOrder(fan1.id, {
      draftProfileId: profile.id,
      intentType: "GENESIS_PASS",
      amountCents: 10_000,
      binding: true,
    });
    expect(order.paymentAuthStatus).toBe("AUTHORIZED");
    expect(order.paymentAuthRef).toBeTruthy();

    await demandMod.cancelDemandOrder(fan1.id, order.id);
    const after = await prisma.fanDemandOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paymentAuthStatus).toBe("RELEASED");
    expect(after.refundStatus).toBe("REFUNDED");
    const profileAfter = await prisma.draftProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(profileAfter.pledgedDemandTotal).toBe(0);
  });
});

describe("claim flow + launch threshold", () => {
  beforeEach(resetDb);

  it("runs the full pipeline to THRESHOLD_MET and scheduled launch", async () => {
    const { scout, admin, fan1, fan2, mira, profile } = await setupApprovedDraft();

    // Fans pledge enough to satisfy the (test-sized) gate: 2 backers, $200.
    for (const fan of [fan1, fan2]) {
      await demandMod.placeDemandOrder(fan.id, {
        draftProfileId: profile.id,
        intentType: "GENESIS_PASS",
        amountCents: 10_000,
        binding: true,
      });
    }

    // MIRA claims.
    const creator = await claimMod.startClaim(mira.id, profile.id);
    expect(creator.status).toBe("CLAIM_STARTED");

    // Cannot double-claim.
    await expect(claimMod.startClaim(fan1.id, profile.id)).rejects.toThrow(/already/i);

    await claimMod.submitVerification(mira.id, creator.id, {
      bio: "Indie singer from the draft board.",
      story: "Fans put me here — now let's make the first video happen together.",
      socialLinks: ["https://tiktok.com/@mira"],
      termsAccepted: true,
    });

    // Admin approves: market shell, threshold, demand transfer, bounty payout.
    await claimMod.approveVerification(admin.id, creator.id);

    const approved = await prisma.creator.findUniqueOrThrow({
      where: { id: creator.id },
      include: { market: true, launchThreshold: true },
    });
    expect(approved.status).toBe("APPROVED");
    expect(approved.market?.ticker).toBe("MIRA");
    expect(approved.market?.status).toBe("PRE_LAUNCH_DEMAND");

    const transferred = await prisma.fanDemandOrder.count({ where: { creatorId: creator.id } });
    expect(transferred).toBe(2);

    // Scout got the bounty + badge; ledger stays balanced.
    const bounty = await prisma.claimBounty.findUniqueOrThrow({ where: { draftProfileId: profile.id } });
    expect(bounty.status).toBe("PAID");
    expect(bounty.paidToUserId).toBe(scout.id);
    expect(await balance({ account: "SCOUT_REWARDS", userId: scout.id })).toBe(bounty.amountCents);
    await assertLedgerBalanced();
    expect(
      await prisma.userBadge.count({ where: { userId: scout.id, badgeType: "GENESIS_SCOUT" } }),
    ).toBe(1);

    // Threshold: backers+demand met, but perks/mission/kit still missing.
    expect(approved.launchThreshold?.status).toBe("NOT_READY");

    await claimMod.configurePerks(mira.id, creator.id, {
      perks: ["Early access to drops", "Backstage Q&A", "Genesis wall spot"],
    });
    await claimMod.configurePayout(mira.id, creator.id);
    // Mission module lands in a later phase; satisfy the gate directly.
    await prisma.mission.create({
      data: {
        creatorId: creator.id,
        title: "First Music Video",
        goalCents: 1_200_000,
        deadline: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        useOfFunds: "Video production",
        rewardTiers: [],
        status: "UNDER_REVIEW",
      },
    });
    await claimMod.approveLaunchKit(admin.id, creator.id);

    const threshold = await prisma.launchThreshold.findUniqueOrThrow({ where: { creatorId: creator.id } });
    expect(threshold.status).toBe("THRESHOLD_MET");
    expect(threshold.confirmedBackers).toBe(2);
    expect(threshold.confirmedDemandCents).toBe(20_000);

    // Schedule launch: opens confirmation window + creates the auction.
    const launchAt = new Date(Date.now() + 48 * 3600 * 1000);
    await claimMod.scheduleLaunch(admin.id, creator.id, launchAt);

    const scheduled = await prisma.creator.findUniqueOrThrow({
      where: { id: creator.id },
      include: { market: { include: { auction: true } } },
    });
    expect(scheduled.status).toBe("LAUNCHING_SOON");
    expect(scheduled.market?.auction?.status).toBe("COLLECTING");

    const windowOrders = await prisma.fanDemandOrder.count({
      where: { creatorId: creator.id, confirmationStatus: "CONFIRMATION_WINDOW" },
    });
    expect(windowOrders).toBe(2);
  });

  it("refuses to schedule launch below threshold (no dead markets)", async () => {
    const { admin, mira, profile } = await setupApprovedDraft();
    const creator = await claimMod.startClaim(mira.id, profile.id);
    await claimMod.submitVerification(mira.id, creator.id, {
      bio: "Indie singer from the draft board.",
      story: "Fans put me here — now let's make the first video happen together.",
      socialLinks: ["https://tiktok.com/@mira"],
      termsAccepted: true,
    });
    await claimMod.approveVerification(admin.id, creator.id);
    await expect(
      claimMod.scheduleLaunch(admin.id, creator.id, new Date(Date.now() + 3600_000)),
    ).rejects.toThrow(/threshold/i);
  });

  it("enforces the creator state machine on bad transitions", async () => {
    const { mira, profile } = await setupApprovedDraft();
    const creator = await claimMod.startClaim(mira.id, profile.id);
    // approveVerification from CLAIM_STARTED (not VERIFICATION_PENDING) must fail
    const admin = await makeUser({ roles: ["ADMIN"] });
    await expect(claimMod.approveVerification(admin.id, creator.id)).rejects.toThrow(/transition/i);
  });
});
