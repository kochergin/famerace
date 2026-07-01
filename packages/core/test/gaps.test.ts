import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as auctionMod from "../src/modules/auction";
import * as claimMod from "../src/modules/claim";
import * as demandMod from "../src/modules/demand";
import * as draftMod from "../src/modules/draft";
import * as launchkitMod from "../src/modules/launchkit";
import { assertLedgerBalanced, balance } from "../src/modules/ledger";
import * as messagesMod from "../src/modules/messages";
import * as missionsMod from "../src/modules/missions";
import * as notifyMod from "../src/modules/notify";
import * as requestsMod from "../src/modules/requests";
import * as safetyMod from "../src/modules/safety";
import * as streetteamMod from "../src/modules/streetteam";
import { makeUser, resetDb } from "./helpers";

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
  for (const fan of [fan1, fan2]) {
    await demandMod.placeDemandOrder(fan.id, {
      draftProfileId: profile.id,
      intentType: "MARKET_BUY",
      amountCents: 10_000,
      binding: true,
    });
  }
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
    goalCents: 100_000,
    deadlineDays: 14,
    useOfFunds: "Video production and editing budget",
    rewardTiers: [],
    refundRule: "ALL_OR_NOTHING",
    matchEligible: true,
  });
  await claimMod.approveLaunchKit(admin.id, creator.id);
  await claimMod.scheduleLaunch(admin.id, creator.id, new Date(Date.now() + 3_600_000));
  await auctionMod.launchNow(admin.id, creator.id);
  return { scout, admin, fan1, fan2, mira, creator, mission, profile };
}

describe("paid messages (§9.10)", () => {
  beforeEach(resetDb);

  it("respond earns 80/20, reject refunds in full — ledger balanced", async () => {
    const { mira, fan1, creator, admin } = await liveCreator();
    void admin;
    const msg1 = await messagesMod.sendPaidMessage(fan1.id, {
      creatorId: creator.id,
      priceCents: 2_000,
      body: "Any chance of an acoustic set next month?",
    });
    expect(await balance({ account: "CREATOR_PENDING", creatorId: creator.id })).toBe(2_000);

    const earnedBefore = await balance({ account: "CREATOR_EARNED", creatorId: creator.id });
    await messagesMod.respondToMessage(mira.id, msg1.id, "Yes — backers pick the setlist.");
    expect((await balance({ account: "CREATOR_EARNED", creatorId: creator.id })) - earnedBefore).toBe(1_600);
    expect(await balance({ account: "CREATOR_PENDING", creatorId: creator.id })).toBe(0);

    const fan2msg = await messagesMod.sendPaidMessage(fan1.id, {
      creatorId: creator.id,
      priceCents: 1_000,
      body: "Second question about the tour schedule please!",
    });
    await messagesMod.rejectMessage(mira.id, fan2msg.id);
    const rejected = await prisma.paidMessage.findUniqueOrThrow({ where: { id: fan2msg.id } });
    expect(rejected.status).toBe("REFUNDED");
    expect(await balance({ account: "CREATOR_PENDING", creatorId: creator.id })).toBe(0);
    await assertLedgerBalanced();
  });

  it("blocks prohibited message content", async () => {
    const { fan1, creator } = await liveCreator();
    await expect(
      messagesMod.sendPaidMessage(fan1.id, {
        creatorId: creator.id,
        priceCents: 1_000,
        body: "I bet you get cancelled — gets arrested next week for sure.",
      }),
    ).rejects.toThrow(/prohibited/i);
  });
});

describe("request menu (§9.11)", () => {
  beforeEach(resetDb);

  it("escrows on order, releases 85/15 on delivery, refunds otherwise", async () => {
    const { mira, fan1, fan2, creator } = await liveCreator();
    const item = await requestsMod.configureItem(mira.id, {
      title: "Private listening party",
      priceCents: 20_000,
      deliveryDays: 14,
    });
    const order1 = await requestsMod.orderItem(fan1.id, item.id);
    const order2 = await requestsMod.orderItem(fan2.id, item.id);
    expect(await balance({ account: "CREATOR_PENDING", creatorId: creator.id })).toBe(40_000);

    const earnedBefore = await balance({ account: "CREATOR_EARNED", creatorId: creator.id });
    await requestsMod.deliverOrder(mira.id, order1.id);
    expect((await balance({ account: "CREATOR_EARNED", creatorId: creator.id })) - earnedBefore).toBe(17_000);

    await requestsMod.refundOrder(mira.id, order2.id);
    expect(await balance({ account: "CREATOR_PENDING", creatorId: creator.id })).toBe(0);
    const refunded = await prisma.requestOrder.findUniqueOrThrow({ where: { id: order2.id } });
    expect(refunded.status).toBe("REFUNDED");
    await assertLedgerBalanced();
  });
});

describe("prohibited-content blocklist (§15.4)", () => {
  beforeEach(resetDb);

  it("hard terms block nominations outright", async () => {
    const scout = await makeUser();
    await expect(
      draftMod.nominate(scout.id, {
        nameOrHandle: "SOMEONE",
        category: "MUSICIAN",
        thesis: "Market on whether they get arrested before the album drops.",
      }),
    ).rejects.toThrow(/prohibited/i);
  });

  it("soft terms flag the profile for priority review", async () => {
    const scout = await makeUser();
    const { profile } = await draftMod.nominate(scout.id, {
      nameOrHandle: "FIGHTER",
      category: "MUSICIAN",
      thesis: "Comeback story after the injury — the next album will be huge.",
    });
    const fresh = await prisma.draftProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(fresh.moderationStatus).toBe("FLAGGED");
    const item = await prisma.moderationItem.findFirstOrThrow({
      where: { objectType: "DraftProfile", objectId: profile.id },
    });
    expect(item.notes).toMatch(/flagged/i);
  });
});

describe("crew counters (§9A.7)", () => {
  beforeEach(resetDb);

  it("mission funding and claimed nominations credit the member's crew", async () => {
    const { admin, fan1, scout, mission } = await liveCreator();
    // fan1 founds a crew, then funds the mission → missionsFunded +1.
    const crew = await streetteamMod.createCrew(fan1.id, { name: "Tokyo Angels" });
    await missionsMod.approveMission(admin.id, mission.id);
    await missionsMod.contribute(fan1.id, mission.id, 5_000);
    await missionsMod.contribute(fan1.id, mission.id, 2_000); // second one: no double count
    const after = await prisma.crew.findUniqueOrThrow({ where: { id: crew.id } });
    expect(after.missionsFunded).toBe(1);
    expect(after.score).toBeGreaterThan(0);

    // A scout in a crew gets creatorsClaimed when their nomination claims.
    const scoutCrew = await streetteamMod.createCrew(scout.id, { name: "Scout Desk" });
    const kaiUser = await makeUser();
    const { profile: kaiDraft } = await draftMod.nominate(scout.id, {
      nameOrHandle: "KAI",
      category: "BUILDER_FOUNDER",
      thesis: "Ships an AI tool every week — deserves the draft.",
    });
    await draftMod.moderateDraft(admin.id, kaiDraft.id, "APPROVED");
    const kai = await claimMod.startClaim(kaiUser.id, kaiDraft.id);
    await claimMod.submitVerification(kaiUser.id, kai.id, {
      bio: "Builder from the draft board.",
      story: "Fifty-two launches later, the next one is with backers.",
      socialLinks: ["https://x.com/kai"],
      termsAccepted: true,
    });
    await claimMod.approveVerification(admin.id, kai.id);
    const crewAfter = await prisma.crew.findUniqueOrThrow({ where: { id: scoutCrew.id } });
    expect(crewAfter.creatorsClaimed).toBe(1);
  });
});

describe("match fund (§9A.10)", () => {
  beforeEach(resetDb);

  it("matches eligible contributions at the ratio within fund caps", async () => {
    const { admin, fan1, mission } = await liveCreator();
    await prisma.matchFund.create({
      data: { seasonName: "Test Season", totalCents: 1_000_000, matchRatio: 0.25, creatorCap: 500_000 },
    });
    await missionsMod.approveMission(admin.id, mission.id);
    await missionsMod.contribute(fan1.id, mission.id, 10_000);

    const funded = await prisma.mission.findUniqueOrThrow({ where: { id: mission.id } });
    expect(funded.matchCents).toBe(2_500); // 25% of $100
    expect(funded.fundedCents).toBe(12_500);
    const fund = await prisma.matchFund.findFirstOrThrow();
    expect(fund.spentCents).toBe(2_500);
    expect(await balance({ account: "MISSION_ESCROW", missionId: mission.id })).toBe(12_500);
    await assertLedgerBalanced();
  });
});

describe("notifications + mute (§9.19/§9.1)", () => {
  beforeEach(resetDb);

  it("notify() respects the user's mute setting", async () => {
    const user = await makeUser();
    await notifyMod.notify(prisma, { userId: user.id, type: "ROSTER_UPDATE", title: "First" });
    expect(await notifyMod.unreadCount(user.id)).toBe(1);

    await notifyMod.setMuted(user.id, true);
    await notifyMod.notify(prisma, { userId: user.id, type: "ROSTER_UPDATE", title: "Muted away" });
    expect(await notifyMod.unreadCount(user.id)).toBe(1);

    await notifyMod.markAllRead(user.id);
    expect(await notifyMod.unreadCount(user.id)).toBe(0);
  });
});

describe("launch kit (§9.18)", () => {
  beforeEach(resetDb);

  it("generates all blocks with the disclosure embedded in earning templates", async () => {
    const { mira } = await liveCreator();
    const kit = await launchkitMod.kitForUser(mira.id);
    expect(kit.blocks.length).toBeGreaterThanOrEqual(9);
    for (const id of ["x_post", "tiktok_script", "telegram", "discord", "mission_announcement"]) {
      const block = kit.blocks.find((b) => b.id === id);
      expect(block, id).toBeDefined();
      expect(block!.content, id).toContain("#ad / paid partnership");
    }
    expect(kit.blocks.find((b) => b.id === "x_post")!.content).toContain("famerace.fun/c/mira");
  });
});

describe("reporting & blocking (§15.9)", () => {
  beforeEach(resetDb);

  it("deduplicates open reports and enforces block on paid messages", async () => {
    const { fan1, creator, mira } = await liveCreator();
    await safetyMod.fileReport(fan1.id, {
      objectType: "Creator",
      objectId: creator.id,
      reason: "OTHER",
      detail: "Testing the report path",
    });
    await expect(
      safetyMod.fileReport(fan1.id, { objectType: "Creator", objectId: creator.id, reason: "OTHER" }),
    ).rejects.toThrow(/already/i);

    const fanUser = await prisma.user.findUniqueOrThrow({ where: { id: fan1.id } });
    await safetyMod.blockUser(mira.id, fanUser.username);
    await expect(
      messagesMod.sendPaidMessage(fan1.id, {
        creatorId: creator.id,
        priceCents: 1_000,
        body: "This should bounce because the creator blocked me.",
      }),
    ).rejects.toThrow(/cannot message/i);
    await safetyMod.unblockUser(mira.id, fanUser.username);
    const message = await messagesMod.sendPaidMessage(fan1.id, {
      creatorId: creator.id,
      priceCents: 1_000,
      body: "Unblocked now — this one should go through fine.",
    });
    expect(message.status).toBe("SENT");
  });
});
