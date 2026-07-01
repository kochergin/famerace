import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as auctionMod from "../src/modules/auction";
import * as claimMod from "../src/modules/claim";
import * as demandMod from "../src/modules/demand";
import * as draftMod from "../src/modules/draft";
import { assertLedgerBalanced, balance } from "../src/modules/ledger";
import * as marketMod from "../src/modules/market";
import { makeUser, resetDb } from "./helpers";

/** Drive a creator from nomination all the way to LAUNCHING_SOON. */
async function creatorAtLaunchingSoon() {
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

  // fan1 wants the opening curve fill, fan2 wants a Genesis Pass.
  await demandMod.placeDemandOrder(fan1.id, {
    draftProfileId: profile.id,
    intentType: "MARKET_BUY",
    amountCents: 15_000,
    binding: true,
  });
  await demandMod.placeDemandOrder(fan2.id, {
    draftProfileId: profile.id,
    intentType: "GENESIS_PASS",
    amountCents: 10_000,
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
  await prisma.mission.create({
    data: {
      creatorId: creator.id,
      title: "First Music Video",
      goalCents: 1_200_000,
      deadline: new Date(Date.now() + 14 * 86_400_000),
      useOfFunds: "Video production",
      rewardTiers: [],
      status: "UNDER_REVIEW",
    },
  });
  await claimMod.approveLaunchKit(admin.id, creator.id);
  await claimMod.scheduleLaunch(admin.id, creator.id, new Date(Date.now() + 3_600_000));
  return { scout, admin, fan1, fan2, mira, creator, profile };
}

describe("opening auction settlement", () => {
  beforeEach(resetDb);

  it("settles: curve fill, genesis pass, live market, balanced ledger", async () => {
    const { admin, fan1, fan2, creator } = await creatorAtLaunchingSoon();

    await auctionMod.launchNow(admin.id, creator.id);

    const live = await prisma.creator.findUniqueOrThrow({
      where: { id: creator.id },
      include: { market: { include: { auction: true } } },
    });
    expect(live.status).toBe("LIVE");
    expect(live.market?.status).toBe("GENESIS_CURVE");
    expect(live.market?.auction?.status).toBe("SETTLED");
    expect(live.market!.supplyUnits).toBeGreaterThan(0);

    // fan1 got curve units with a backer rank.
    const holding = await prisma.holding.findUniqueOrThrow({
      where: { userId_creatorMarketId: { userId: fan1.id, creatorMarketId: live.market!.id } },
    });
    expect(holding.amountUnits).toBe(live.market!.supplyUnits);
    expect(holding.backerRank).toBe(1);
    expect(holding.isGenesis).toBe(true);

    // fan2 got Genesis Pass #1 with the 80/12/8 primary split.
    const pass = await prisma.genesisPass.findUniqueOrThrow({
      where: { userId_creatorId: { userId: fan2.id, creatorId: creator.id } },
    });
    expect(pass.backerNumber).toBe(1);
    expect(await balance({ account: "CREATOR_EARNED", creatorId: creator.id })).toBe(8_000);

    // Reserve fully backs the curve supply.
    const reserve = await balance({ account: "MARKET_RESERVE", creatorId: creator.id });
    expect(reserve).toBeGreaterThan(0);
    await assertLedgerBalanced();

    // Both backers are on the roster as BACKED.
    expect(
      await prisma.rosterEntry.count({ where: { creatorId: creator.id, source: "BACKED" } }),
    ).toBe(2);

    // Settlement is idempotent — second run is a no-op.
    await auctionMod.settleDueLaunches(new Date(Date.now() + 7_200_000));
    await assertLedgerBalanced();
  });

  it("post-launch curve trading keeps the reserve solvent", async () => {
    const { admin, fan1, creator } = await creatorAtLaunchingSoon();
    await auctionMod.launchNow(admin.id, creator.id);
    const live = await prisma.creator.findUniqueOrThrow({
      where: { id: creator.id },
      include: { market: true },
    });
    const marketId = live.market!.id;

    const trader = await makeUser();
    const { quote } = await marketMod.buy(trader.id, marketId, 5_000);
    expect(quote.units).toBeGreaterThan(0);

    // Trader sells everything back; fan1 sells everything back.
    await marketMod.sell(trader.id, marketId, quote.units);
    const fan1Holding = await prisma.holding.findUniqueOrThrow({
      where: { userId_creatorMarketId: { userId: fan1.id, creatorMarketId: marketId } },
    });
    await marketMod.sell(fan1.id, marketId, fan1Holding.amountUnits);

    const market = await prisma.creatorMarket.findUniqueOrThrow({ where: { id: marketId } });
    expect(market.supplyUnits).toBe(0);
    expect(market.holderCount).toBe(0);

    // Everyone sold at supply 0 — reserve must be non-negative (rounding dust only).
    const reserve = await balance({ account: "MARKET_RESERVE", creatorId: creator.id });
    expect(reserve).toBeGreaterThanOrEqual(0);
    await assertLedgerBalanced();

    // Backer rank survives a full exit (proof-of-early is permanent).
    const after = await prisma.holding.findUniqueOrThrow({
      where: { userId_creatorMarketId: { userId: fan1.id, creatorMarketId: marketId } },
    });
    expect(after.backerRank).toBe(1);
  });

  it("paused markets refuse trades and resume cleanly", async () => {
    const { admin, creator } = await creatorAtLaunchingSoon();
    await auctionMod.launchNow(admin.id, creator.id);
    const live = await prisma.creator.findUniqueOrThrow({
      where: { id: creator.id },
      include: { market: true },
    });
    const trader = await makeUser();

    await marketMod.pauseMarket(admin.id, live.market!.id, "fraud review");
    await expect(marketMod.buy(trader.id, live.market!.id, 5_000)).rejects.toThrow(/paused/i);
    await marketMod.resumeMarket(admin.id, live.market!.id);
    const { quote } = await marketMod.buy(trader.id, live.market!.id, 5_000);
    expect(quote.units).toBeGreaterThan(0);
  });

  it("charges trading fees per the §12.2 split", async () => {
    const { admin, creator } = await creatorAtLaunchingSoon();
    await auctionMod.launchNow(admin.id, creator.id);
    const live = await prisma.creator.findUniqueOrThrow({
      where: { id: creator.id },
      include: { market: true },
    });
    const before = await balance({ account: "PLATFORM_FEES" });
    const trader = await makeUser();
    await marketMod.buy(trader.id, live.market!.id, 100_000); // $1,000
    const after = await balance({ account: "PLATFORM_FEES" });
    // protocol fee = 0.65% of $1,000 = $6.50
    expect(after - before).toBe(650);
  });
});
