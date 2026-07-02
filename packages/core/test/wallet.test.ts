import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as walletMod from "../src/modules/wallet";
import { makeUser, resetDb } from "./helpers";

const balance = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id }, select: { usdcCents: true } })).usdcCents;

describe("wallet: USDC rail", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEV_FAUCET = "1";
  });

  it("deposits are idempotent by ref (webhook retries never double-credit)", async () => {
    const user = await makeUser({ usdcCents: 0 });
    await walletMod.creditDeposit(user.id, 5_000, "0xhash1");
    await walletMod.creditDeposit(user.id, 5_000, "0xhash1"); // retry
    expect(await balance(user.id)).toBe(5_000);
    await walletMod.creditDeposit(user.id, 2_500, "0xhash2");
    expect(await balance(user.id)).toBe(7_500);
  });

  it("authorize/capture/release move exactly the held amount, idempotently", async () => {
    const provider = new walletMod.UsdcPaymentProvider();
    const user = await makeUser({ usdcCents: 0 });
    await walletMod.creditDeposit(user.id, 10_000, "0xfund");

    // Overdraw is a clean 402, not a negative balance.
    await expect(provider.authorize({ userId: user.id, amountCents: 20_000, purpose: "pledge" }))
      .rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });

    const auth = await provider.authorize({ userId: user.id, amountCents: 4_000, purpose: "pledge" });
    expect(await balance(user.id)).toBe(6_000);

    // Release credits back; releasing twice is a no-op.
    await provider.release(auth.authRef);
    await provider.release(auth.authRef);
    expect(await balance(user.id)).toBe(10_000);

    // Capture consumes the hold; capturing again is a no-op; releasing after
    // capture never refunds.
    const auth2 = await provider.authorize({ userId: user.id, amountCents: 3_000, purpose: "drop" });
    await provider.capture(auth2.authRef);
    await provider.capture(auth2.authRef);
    await provider.release(auth2.authRef);
    expect(await balance(user.id)).toBe(7_000);
  });

  it("withdrawals require an address, a minimum, and sufficient funds", async () => {
    const user = await makeUser({ usdcCents: 0 });
    await walletMod.creditDeposit(user.id, 10_000, "0xw");
    await expect(walletMod.withdraw(user.id, 6_000)).rejects.toMatchObject({ code: "NO_ADDRESS" });
    await prisma.user.update({ where: { id: user.id }, data: { walletAddress: "0x" + "a".repeat(40) } });
    await expect(walletMod.withdraw(user.id, 100)).rejects.toMatchObject({ code: "BAD_AMOUNT" });
    await expect(walletMod.withdraw(user.id, 60_000)).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    await walletMod.withdraw(user.id, 6_000);
    expect(await balance(user.id)).toBe(4_000);
    const entries = await walletMod.history(user.id);
    expect(entries[0]!.kind).toBe("WITHDRAWAL");
  });

  it("deposit address is generated once and stays stable", async () => {
    const user = await makeUser({ usdcCents: 0 });
    const a = await walletMod.ensureDepositAddress(user.id);
    const b = await walletMod.ensureDepositAddress(user.id);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{40}$/);
  });
});

describe("wallet: rail integration with the curve", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("buys debit exactly the charge (change returned), sells credit net proceeds, overdraw releases", async () => {
    const marketMod = await import("../src/modules/market");
    const owner = await makeUser({ roles: ["CREATOR"], usdcCents: 0 });
    const creator = await prisma.creator.create({
      data: { userId: owner.id, displayName: "MIRA", handle: "mira", category: "MUSICIAN", status: "LIVE" },
    });
    const market = await prisma.creatorMarket.create({
      data: { creatorId: creator.id, ticker: "MIRA", status: "GENESIS_CURVE" },
    });

    const fan = await makeUser({ usdcCents: 10_000 });
    const { chargedCents } = await marketMod.buy(fan.id, market.id, 2_500);
    const afterBuy = await balance(fan.id);
    // Hold was 2500; charge <= 2500; change paid back → net debit == chargedCents.
    expect(afterBuy).toBe(10_000 - chargedCents);

    // Overdraw: clean 402, hold fully released, balance untouched.
    await expect(marketMod.buy(fan.id, market.id, 999_999_00)).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await balance(fan.id)).toBe(afterBuy);

    // Sell everything back: net proceeds land on the balance.
    const holding = await prisma.holding.findFirstOrThrow({ where: { userId: fan.id } });
    const { quote } = await marketMod.sell(fan.id, market.id, holding.amountUnits);
    expect(await balance(fan.id)).toBe(afterBuy + quote.netCents);
  });
});
