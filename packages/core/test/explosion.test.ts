import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as adminMod from "../src/modules/admin";
import * as auctionMod from "../src/modules/auction";
import * as claimMod from "../src/modules/claim";
import * as demandMod from "../src/modules/demand";
import * as draftMod from "../src/modules/draft";
import { assertLedgerBalanced } from "../src/modules/ledger";
import * as marketMod from "../src/modules/market";
import { makeUser, resetDb } from "./helpers";

async function liveCreator(handle = "MIRA", category: "MUSICIAN" | "BUILDER_FOUNDER" = "MUSICIAN") {
  const [scout, admin, fan1, fan2, owner] = await Promise.all([
    makeUser(),
    makeUser({ roles: ["ADMIN"] }),
    makeUser(),
    makeUser(),
    makeUser(),
  ]);
  const { profile } = await draftMod.nominate(scout.id, {
    nameOrHandle: handle,
    category,
    thesis: "Rising talent with a fast-growing audience and clear next move.",
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
  const creator = await claimMod.startClaim(owner.id, profile.id);
  await claimMod.submitVerification(owner.id, creator.id, {
    bio: "Rising talent from the draft board.",
    story: "Fans put me here — let's make the next move together.",
    socialLinks: ["https://tiktok.com/@talent"],
    followerCount: 18_200,
    termsAccepted: true,
  });
  await claimMod.approveVerification(admin.id, creator.id);
  await claimMod.configurePerks(owner.id, creator.id, {
    perks: ["Early drops", "Backstage Q&A", "Genesis wall spot"],
  });
  await claimMod.configurePayout(owner.id, creator.id);
  await prisma.mission.create({
    data: {
      creatorId: creator.id,
      title: "First Move",
      goalCents: 100_000,
      deadline: new Date(Date.now() + 14 * 86_400_000),
      useOfFunds: "The concrete next career move",
      rewardTiers: [],
      status: "LIVE",
    },
  });
  await claimMod.approveLaunchKit(admin.id, creator.id);
  return { scout, admin, fan1, fan2, owner, creator, profile };
}

describe("market graduation (§9.6 / §0A.7.5)", () => {
  beforeEach(resetDb);

  it("graduates at the volume+holder thresholds and emits a milestone", async () => {
    const { admin, creator } = await liveCreator();
    await claimMod.scheduleLaunch(admin.id, creator.id, new Date(Date.now() + 3_600_000));
    await auctionMod.launchNow(admin.id, creator.id);
    const market = await prisma.creatorMarket.findUniqueOrThrow({ where: { creatorId: creator.id } });

    // Force the market to sit just under the graduation gate, then trade over it.
    await prisma.creatorMarket.update({
      where: { id: market.id },
      data: {
        volumeTotalCents: BigInt(25_000_000 - 1_000),
        holderCount: 150,
      },
    });
    const whale = await makeUser();
    await marketMod.buy(whale.id, market.id, 5_000);

    const after = await prisma.creatorMarket.findUniqueOrThrow({ where: { id: market.id } });
    expect(after.status).toBe("GRADUATION");
    expect(after.volumeTotalCents).toBeGreaterThan(BigInt(25_000_000));
    const milestone = await prisma.event.findFirst({
      where: { type: "CREATOR_MILESTONE", creatorId: creator.id },
    });
    expect(milestone?.message).toMatch(/graduated/i);

    // Tier 2 via sweep → MATURE.
    await prisma.creatorMarket.update({
      where: { id: market.id },
      data: { volumeTotalCents: BigInt(250_000_000), holderCount: 1_500 },
    });
    const matured = await adminMod.matureGraduatedMarkets();
    expect(matured).toBe(1);
    const final = await prisma.creatorMarket.findUniqueOrThrow({ where: { id: market.id } });
    expect(final.status).toBe("MATURE");

    // Trading still works post-graduation; ledger stays balanced.
    await marketMod.buy(whale.id, market.id, 2_000);
    await assertLedgerBalanced();
  });
});

describe("staggered launches (§0A.7.2)", () => {
  beforeEach(resetDb);

  it("rejects scheduling beyond maxLaunchesPerDay on the same day", async () => {
    const { admin, creator } = await liveCreator();
    const launchAt = new Date(Date.now() + 12 * 3_600_000);
    // Fill the day with synthetic auctions from other markets.
    for (let i = 0; i < 5; i += 1) {
      const filler = await prisma.creator.create({
        data: { displayName: `Filler ${i}`, handle: `filler_${i}`, category: "MUSICIAN", status: "LAUNCHING_SOON" },
      });
      const fillerMarket = await prisma.creatorMarket.create({
        data: { creatorId: filler.id, ticker: `FILL${i}` },
      });
      await prisma.openingAuction.create({
        data: {
          creatorMarketId: fillerMarket.id,
          startTime: new Date(launchAt.getTime() - 3_600_000),
          endTime: launchAt,
          status: "COLLECTING",
        },
      });
    }
    await expect(claimMod.scheduleLaunch(admin.id, creator.id, launchAt)).rejects.toThrow(/max 5/i);
    // The next day is open.
    await claimMod.scheduleLaunch(admin.id, creator.id, new Date(launchAt.getTime() + 86_400_000));
    const scheduled = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
    expect(scheduled.status).toBe("LAUNCHING_SOON");
  });
});

describe("draft rank changes (§0A.9)", () => {
  beforeEach(resetDb);

  it("emits riser events when board order changes", async () => {
    const [scout, admin, fan] = await Promise.all([makeUser(), makeUser({ roles: ["ADMIN"] }), makeUser()]);
    const profiles = [];
    for (const name of ["ALPHA", "BETA", "GAMMA"]) {
      const { profile } = await draftMod.nominate(scout.id, {
        nameOrHandle: name,
        category: "MUSICIAN",
        thesis: "Rising talent with a fast-growing audience right now.",
      });
      await draftMod.moderateDraft(admin.id, profile.id, "APPROVED");
      profiles.push(profile);
    }
    await prisma.draftProfile.update({ where: { id: profiles[0]!.id }, data: { pledgedDemandTotal: 30_000 } });
    await prisma.draftProfile.update({ where: { id: profiles[1]!.id }, data: { pledgedDemandTotal: 20_000 } });

    // First snapshot establishes baseline ranks (no events yet).
    expect(await draftMod.snapshotDraftRanks()).toBe(0);

    // GAMMA takes big demand and rockets from #3 to #1.
    await demandMod.placeDemandOrder(fan.id, {
      draftProfileId: profiles[2]!.id,
      intentType: "GENESIS_PASS",
      amountCents: 100_000,
      binding: true,
    });
    const changes = await draftMod.snapshotDraftRanks();
    expect(changes).toBeGreaterThanOrEqual(1);
    const event = await prisma.event.findFirst({
      where: { type: "DRAFT_RANK_CHANGED", draftProfileId: profiles[2]!.id },
    });
    expect(event?.message).toMatch(/GAMMA climbed to #1/);
  });
});

describe("follower stats (§0B.6)", () => {
  beforeEach(resetDb);

  it("flows from verification input to the creator record", async () => {
    const { creator } = await liveCreator();
    const fresh = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
    expect(fresh.followerCount).toBe(18_200);
  });
});

describe("bigint volume counters (§12.5 scale)", () => {
  beforeEach(resetDb);

  it("volume survives past the 32-bit boundary", async () => {
    const { admin, creator } = await liveCreator();
    await claimMod.scheduleLaunch(admin.id, creator.id, new Date(Date.now() + 3_600_000));
    await auctionMod.launchNow(admin.id, creator.id);
    const market = await prisma.creatorMarket.findUniqueOrThrow({ where: { creatorId: creator.id } });
    await prisma.creatorMarket.update({
      where: { id: market.id },
      data: { volumeTotalCents: BigInt("3000000000") }, // $30M — over int4 max
    });
    const trader = await makeUser();
    await marketMod.buy(trader.id, market.id, 5_000);
    const after = await prisma.creatorMarket.findUniqueOrThrow({ where: { id: market.id } });
    expect(after.volumeTotalCents).toBeGreaterThan(BigInt("3000000000"));
  });
});
