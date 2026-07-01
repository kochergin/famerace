import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as auctionMod from "../src/modules/auction";
import * as backstageMod from "../src/modules/backstage";
import * as claimMod from "../src/modules/claim";
import * as demandMod from "../src/modules/demand";
import * as draftMod from "../src/modules/draft";
import * as dropsMod from "../src/modules/drops";
import { assertLedgerBalanced, balance } from "../src/modules/ledger";
import * as missionsMod from "../src/modules/missions";
import * as payoutsMod from "../src/modules/payouts";
import { makeUser, resetDb } from "./helpers";

/** Launch a live creator with one live mission and a mission pledge waiting. */
async function liveCreator() {
  const [scout, admin, fan1, fan2, mira] = await Promise.all([
    makeUser(),
    makeUser({ roles: ["ADMIN"] }),
    makeUser(),
    makeUser(),
    makeUser(),
  ]);
  const { profile } = await draftMod.nominate(scout.id, {
    nameOrHandle: "MIRA",
    category: "MUSICIAN",
    thesis: "Indie singer with insane hooks, about to break out.",
  });
  await draftMod.moderateDraft(admin.id, profile.id, "APPROVED");
  await demandMod.placeDemandOrder(fan1.id, {
    draftProfileId: profile.id,
    intentType: "MARKET_BUY",
    amountCents: 12_000,
    binding: true,
  });
  await demandMod.placeDemandOrder(fan2.id, {
    draftProfileId: profile.id,
    intentType: "MISSION_PLEDGE",
    amountCents: 8_000,
    binding: true,
  });
  const creator = await claimMod.startClaim(mira.id, profile.id);
  await claimMod.submitVerification(mira.id, creator.id, {
    bio: "Indie singer from the draft board.",
    story: "Fans put me here — let's make the first video happen.",
    socialLinks: ["https://tiktok.com/@mira"],
    termsAccepted: true,
  });
  await claimMod.approveVerification(admin.id, creator.id);
  await claimMod.configurePerks(mira.id, creator.id, {
    perks: ["Early drops", "Backstage Q&A", "Genesis wall spot"],
  });
  await claimMod.configurePayout(mira.id, creator.id);
  const mission = await missionsMod.createMission(mira.id, {
    title: "First Music Video",
    goalCents: 50_000,
    deadlineDays: 14,
    useOfFunds: "Video production, editing, styling, studio",
    rewardTiers: [{ thresholdCents: 1_000, reward: "Mission Badge" }],
    refundRule: "ALL_OR_NOTHING",
  });
  await claimMod.approveLaunchKit(admin.id, creator.id);
  await claimMod.scheduleLaunch(admin.id, creator.id, new Date(Date.now() + 3_600_000));
  await auctionMod.launchNow(admin.id, creator.id);
  return { scout, admin, fan1, fan2, mira, creator, mission, profile };
}

describe("missions", () => {
  beforeEach(resetDb);

  it("approval converts waiting mission pledges into escrowed contributions", async () => {
    const { admin, fan2, mission, creator } = await liveCreator();
    await missionsMod.approveMission(admin.id, mission.id);

    const live = await prisma.mission.findUniqueOrThrow({ where: { id: mission.id } });
    expect(live.status).toBe("LIVE");
    expect(live.fundedCents).toBe(8_000); // fan2's pledge auto-converted
    expect(await balance({ account: "MISSION_ESCROW", missionId: mission.id })).toBe(8_000);

    const pledge = await prisma.fanDemandOrder.findFirstOrThrow({
      where: { userId: fan2.id, intentType: "MISSION_PLEDGE" },
    });
    expect(pledge.paymentAuthStatus).toBe("CAPTURED");
    await assertLedgerBalanced();
    void creator;
  });

  it("funds → escrow release with 5% platform fee → proof-gated completion", async () => {
    const { admin, fan1, mira, mission, creator } = await liveCreator();
    await missionsMod.approveMission(admin.id, mission.id);
    await missionsMod.contribute(fan1.id, mission.id, 42_000); // 8k + 42k = 50k goal

    const funded = await prisma.mission.findUniqueOrThrow({ where: { id: mission.id } });
    expect(funded.status).toBe("FUNDED");
    expect(
      await prisma.userBadge.count({ where: { badgeType: "MISSION_BACKER", sourceRef: mission.id } }),
    ).toBe(2);

    const before = await balance({ account: "CREATOR_EARNED", creatorId: creator.id });
    await missionsMod.startWork(mira.id, mission.id);
    const after = await balance({ account: "CREATOR_EARNED", creatorId: creator.id });
    expect(after - before).toBe(50_000 - 2_500); // minus 5% fee
    expect(await balance({ account: "MISSION_ESCROW", missionId: mission.id })).toBe(0);

    // Completion requires proof.
    await expect(missionsMod.completeMission(mira.id, mission.id)).rejects.toThrow(/proof/i);
    await missionsMod.postUpdate(mira.id, mission.id, {
      title: "Video is out",
      body: "Shot, edited and published. You funded this.",
      proofUrl: "https://youtube.com/watch?v=demo",
    });
    const completed = await missionsMod.completeMission(mira.id, mission.id);
    expect(completed.status).toBe("COMPLETED");
    await assertLedgerBalanced();
  });

  it("all-or-nothing missions refund contributions on expiry", async () => {
    const { admin, fan1, mission } = await liveCreator();
    await missionsMod.approveMission(admin.id, mission.id);
    await missionsMod.contribute(fan1.id, mission.id, 10_000);

    await prisma.mission.update({
      where: { id: mission.id },
      data: { deadline: new Date(Date.now() - 1000) },
    });
    await missionsMod.expireMissions();

    const expired = await prisma.mission.findUniqueOrThrow({ where: { id: mission.id } });
    expect(expired.status).toBe("EXPIRED");
    expect(await balance({ account: "MISSION_ESCROW", missionId: mission.id })).toBe(0);
    const contributions = await prisma.missionContribution.findMany({ where: { missionId: mission.id } });
    expect(contributions.every((c) => c.refunded)).toBe(true);
    await assertLedgerBalanced();
  });
});

describe("backstage + drops + payouts", () => {
  beforeEach(resetDb);

  it("locks and unlocks the backstage feed by membership", async () => {
    const { mira, creator } = await liveCreator();
    const fan = await makeUser();
    const tier = await backstageMod.configureTier(mira.id, {
      name: "Inner circle",
      priceCents: 1_000,
      accessType: "PAID",
      minHoldingUnits: 0,
      benefits: ["Demos first"],
    });
    await backstageMod.createPost(mira.id, {
      title: "Studio diary #1",
      body: "Secret demo link inside",
      preview: "New song coming…",
      visibility: "MEMBERS",
    });

    const lockedFeed = await backstageMod.feedFor(creator.id, fan.id);
    expect(lockedFeed[0]?.unlocked).toBe(false);

    await backstageMod.subscribe(fan.id, tier.id);
    const openFeed = await backstageMod.feedFor(creator.id, fan.id);
    expect(openFeed[0]?.unlocked).toBe(true);

    // 85/15 split (§12.2)
    expect(await balance({ account: "CREATOR_EARNED", creatorId: creator.id })).toBeGreaterThanOrEqual(850);

    // Cancel keeps access until renewal, then expires via sweep.
    await backstageMod.cancelMembership(fan.id, creator.id);
    expect((await backstageMod.feedFor(creator.id, fan.id))[0]?.unlocked).toBe(true);
    await prisma.backstageMembership.updateMany({
      where: { userId: fan.id },
      data: { renewsAt: new Date(Date.now() - 1000) },
    });
    await backstageMod.sweepMemberships();
    expect((await backstageMod.feedFor(creator.id, fan.id))[0]?.unlocked).toBe(false);
  });

  it("drops enforce quantity limits and split 85/10/5", async () => {
    const { mira, creator } = await liveCreator();
    const [buyer1, buyer2] = await Promise.all([makeUser(), makeUser()]);
    const drop = await dropsMod.createDrop(mira.id, {
      title: "Unreleased demo",
      description: "First listen of the new single.",
      priceCents: 2_000,
      quantityLimit: 1,
    });
    const before = await balance({ account: "CREATOR_EARNED", creatorId: creator.id });
    await dropsMod.purchaseDrop(buyer1.id, drop.id);
    expect((await balance({ account: "CREATOR_EARNED", creatorId: creator.id })) - before).toBe(1_700);
    await expect(dropsMod.purchaseDrop(buyer2.id, drop.id)).rejects.toThrow(/sold out|no longer/i);
    const soldOut = await prisma.drop.findUniqueOrThrow({ where: { id: drop.id } });
    expect(soldOut.status).toBe("SOLD_OUT");
    await assertLedgerBalanced();
  });

  it("payouts respect available balance and debit the ledger", async () => {
    const { mira, creator } = await liveCreator();
    const fan = await makeUser();
    await dropsMod.tip(fan.id, creator.id, 10_000, "For the video!");

    const balances = await payoutsMod.creatorBalances(creator.id);
    expect(balances.availableCents).toBeGreaterThanOrEqual(9_000); // 90% of tip + auction fees

    await expect(payoutsMod.requestPayout(mira.id, balances.availableCents + 10_000)).rejects.toThrow(
      /exceeds/i,
    );
    const payout = await payoutsMod.requestPayout(mira.id, 5_000);
    expect(payout.status).toBe("APPROVED"); // under review threshold
    await payoutsMod.sendPayout(mira.id, payout.id, "SYSTEM");
    const after = await payoutsMod.creatorBalances(creator.id);
    expect(balances.availableCents - after.availableCents).toBe(5_000);
    await assertLedgerBalanced();
  });
});
