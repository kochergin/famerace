import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as advanceMod from "../src/modules/advance";
import * as claimMod from "../src/modules/claim";
import * as demandMod from "../src/modules/demand";
import * as draftMod from "../src/modules/draft";
import * as payoutsMod from "../src/modules/payouts";
import { assertLedgerBalanced, postLedgerTx } from "../src/modules/ledger";
import { makeUser, resetDb } from "./helpers";

async function claimedCreatorWithDemand(pledgeCents: number[]) {
  const [scout, admin, creatorUser] = await Promise.all([makeUser(), makeUser({ roles: ["ADMIN"] }), makeUser()]);
  const { profile } = await draftMod.nominate(scout.id, {
    nameOrHandle: "MIRA",
    category: "MUSICIAN",
    thesis: "Hooks that live rent-free in your head — about to break out.",
  });
  await draftMod.moderateDraft(admin.id, profile.id, "APPROVED");
  for (const cents of pledgeCents) {
    const fan = await makeUser();
    await demandMod.placeDemandOrder(fan.id, {
      draftProfileId: profile.id,
      intentType: "MARKET_BUY",
      amountCents: cents,
      binding: true,
    });
  }
  const creator = await claimMod.startClaim(creatorUser.id, profile.id);
  return { creator, creatorUser };
}

const usdc = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id }, select: { usdcCents: true } })).usdcCents;

describe("the advance: claim & get paid today", () => {
  beforeEach(resetDb);

  it("eligibility is 20% of authorized demand, capped, min $50, once", async () => {
    // $600 authorized → $120 advance
    const { creator, creatorUser } = await claimedCreatorWithDemand([40_000, 20_000]);
    const before = await advanceMod.advanceStatus(creator.id);
    expect(before.eligibleCents).toBe(12_000);

    const balBefore = await usdc(creatorUser.id);
    await advanceMod.takeAdvance(creatorUser.id);
    expect(await usdc(creatorUser.id)).toBe(balBefore + 12_000);
    await assertLedgerBalanced();

    const after = await advanceMod.advanceStatus(creator.id);
    expect(after.eligibleCents).toBe(0);
    await expect(advanceMod.takeAdvance(creatorUser.id)).rejects.toMatchObject({ code: "ADVANCE_TAKEN" });
  });

  it("below the minimum there is no advance; the cap holds at $1,000", async () => {
    const small = await claimedCreatorWithDemand([10_000]); // 20% = $20 < $50 min
    expect((await advanceMod.advanceStatus(small.creator.id)).eligibleCents).toBe(0);
    await expect(advanceMod.takeAdvance(small.creatorUser.id)).rejects.toMatchObject({
      code: "NOT_ELIGIBLE",
    });
  });

  it("earnings repay the advance before any payout", async () => {
    const { creator, creatorUser } = await claimedCreatorWithDemand([50_000]); // $100 advance
    await advanceMod.takeAdvance(creatorUser.id);

    // Simulate $250 of earnings + active payout config.
    await prisma.$transaction(async (tx) => {
      await postLedgerTx(tx, "TIP", [
        { account: "EXTERNAL", deltaCents: -25_000, userId: creatorUser.id },
        { account: "CREATOR_EARNED", deltaCents: 25_000, creatorId: creator.id },
      ]);
    });
    await prisma.creator.update({ where: { id: creator.id }, data: { payoutStatus: "ACTIVE" } });

    // Request $200: $100 clears the advance first → only $150 available.
    await expect(payoutsMod.requestPayout(creatorUser.id, 20_000)).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
    const advance = await prisma.creatorAdvance.findUniqueOrThrow({ where: { creatorId: creator.id } });
    expect(advance.repaidCents).toBe(10_000);
    await assertLedgerBalanced();

    // A $100 request now fits, and no double-repay happens.
    const payout = await payoutsMod.requestPayout(creatorUser.id, 10_000);
    expect(payout.status).toBe("APPROVED");
    expect((await prisma.creatorAdvance.findUniqueOrThrow({ where: { creatorId: creator.id } })).repaidCents).toBe(10_000);
  });
});
