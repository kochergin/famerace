import { prisma, type CreatorMarket, type Prisma } from "@famerace/db";
import { config } from "../config";
import { buyCostCents, sellProceedsCents, spotPriceCents, unitsForBudget } from "../curve";
import { DomainError, notFound } from "../errors";
import { emitEvent } from "../events";
import { paymentProvider } from "../payments";
import { assertTransition, audit, MARKET_TRANSITIONS } from "../statemachine";
import { postLedgerTx } from "./ledger";

// Bonding-curve market (PRD §9.6). Money paths:
//   buy:  user pays gross → fees split off → net enters MARKET_RESERVE
//   sell: gross leaves MARKET_RESERVE → fees split off → net to user
// The reserve always holds exactly the curve integral of outstanding supply
// (minus rounding in the platform's favor), so every sell is backed.

export type FeeBreakdown = {
  creatorFeeCents: number;
  protocolFeeCents: number;
  scoutFeeCents: number;
};

function splitFees(market: CreatorMarket, grossCents: number): FeeBreakdown & { totalFeeCents: number } {
  const creatorFeeCents = Math.floor((grossCents * market.creatorFeeBps) / 10_000);
  const protocolFeeCents = Math.floor((grossCents * market.protocolFeeBps) / 10_000);
  const scoutFeeCents = Math.floor((grossCents * market.scoutFeeBps) / 10_000);
  return {
    creatorFeeCents,
    protocolFeeCents,
    scoutFeeCents,
    totalFeeCents: creatorFeeCents + protocolFeeCents + scoutFeeCents,
  };
}

const TRADEABLE: readonly string[] = ["GENESIS_CURVE", "GRADUATION", "MATURE"];

export async function getMarketByHandle(handle: string) {
  const creator = await prisma.creator.findUnique({
    where: { handle },
    include: { market: true },
  });
  if (!creator?.market) throw notFound("Market");
  return { creator, market: creator.market };
}

export function quoteBuy(market: CreatorMarket, spendCents: number) {
  const fees = splitFees(market, spendCents);
  const netCents = spendCents - fees.totalFeeCents;
  const units = unitsForBudget(market, market.supplyUnits, netCents);
  const costCents = buyCostCents(market, market.supplyUnits, units);
  return {
    units,
    costCents,
    changeCents: netCents - costCents,
    fees,
    priceAfterCents: spotPriceCents(market, market.supplyUnits + units),
  };
}

export function quoteSell(market: CreatorMarket, units: number) {
  const grossCents = sellProceedsCents(market, market.supplyUnits, units);
  const fees = splitFees(market, grossCents);
  return {
    grossCents,
    netCents: grossCents - fees.totalFeeCents,
    fees,
    priceAfterCents: spotPriceCents(market, Math.max(0, market.supplyUnits - units)),
  };
}

/** Anti-bot launch-window guard (PRD §9.6). */
async function assertLaunchWindowLimits(
  tx: Prisma.TransactionClient,
  market: CreatorMarket,
  userId: string,
  units: number,
) {
  if (!market.launchTime) return;
  const windowEnd = market.launchTime.getTime() + config.antiBot.launchWindowMinutes * 60_000;
  if (Date.now() > windowEnd) return;
  if (units > config.antiBot.maxUnitsPerLaunchBuy) {
    throw new DomainError(
      "LAUNCH_LIMIT",
      `Launch window cap: max ${config.antiBot.maxUnitsPerLaunchBuy} units per back`,
      429,
    );
  }
  const recentBuys = await tx.marketTransaction.count({
    where: { creatorMarketId: market.id, userId, side: "BUY", createdAt: { gte: market.launchTime } },
  });
  if (recentBuys >= config.antiBot.maxBuysInLaunchWindow) {
    throw new DomainError("LAUNCH_LIMIT", "Launch window cap: too many backs, slow down", 429);
  }
}

/** Assign the next permanent backer rank for a market (Backer Wall, §0B.7). */
async function nextBackerRank(tx: Prisma.TransactionClient, creatorMarketId: string): Promise<number> {
  const max = await tx.holding.aggregate({
    where: { creatorMarketId },
    _max: { backerRank: true },
  });
  return (max._max.backerRank ?? 0) + 1;
}

export async function buy(userId: string, marketId: string, spendCents: number) {
  if (!Number.isInteger(spendCents) || spendCents < 100) {
    throw new DomainError("BAD_AMOUNT", "Minimum back is $1");
  }
  return prisma.$transaction(async (tx) => {
    const market = await tx.creatorMarket.findUnique({
      where: { id: marketId },
      include: { creator: true },
    });
    if (!market) throw notFound("Market");
    if (!TRADEABLE.includes(market.status)) {
      throw new DomainError("MARKET_NOT_OPEN", `Market is ${market.status.replaceAll("_", " ").toLowerCase()}`);
    }

    const quote = quoteBuy(market, spendCents);
    if (quote.units <= 0) throw new DomainError("AMOUNT_TOO_SMALL", "Amount too small for one unit");
    await assertLaunchWindowLimits(tx, market, userId, quote.units);

    // gross = cost + fees + change-back; charge exactly cost + fees.
    const chargedCents = quote.costCents + quote.fees.totalFeeCents;
    const ledgerTxId = await postLedgerTx(
      tx,
      "CURVE_TRADE",
      [
        { account: "EXTERNAL", deltaCents: -chargedCents, userId },
        { account: "MARKET_RESERVE", deltaCents: quote.costCents, creatorId: market.creatorId },
        { account: "CREATOR_EARNED", deltaCents: quote.fees.creatorFeeCents, creatorId: market.creatorId },
        { account: "PLATFORM_FEES", deltaCents: quote.fees.protocolFeeCents },
        { account: "SCOUT_REWARDS", deltaCents: quote.fees.scoutFeeCents, creatorId: market.creatorId },
      ],
      { kind: "curve_buy", marketId, units: quote.units },
    );

    const existing = await tx.holding.findUnique({
      where: { userId_creatorMarketId: { userId, creatorMarketId: marketId } },
    });
    if (existing) {
      const totalUnits = existing.amountUnits + quote.units;
      const newAvg = Math.round(
        (existing.avgEntryCents * existing.amountUnits + quote.costCents) / totalUnits,
      );
      await tx.holding.update({
        where: { id: existing.id },
        data: { amountUnits: totalUnits, avgEntryCents: newAvg },
      });
    } else {
      await tx.holding.create({
        data: {
          userId,
          creatorMarketId: marketId,
          amountUnits: quote.units,
          avgEntryCents: Math.round(quote.costCents / quote.units),
          backerRank: await nextBackerRank(tx, marketId),
        },
      });
      await tx.creatorMarket.update({
        where: { id: marketId },
        data: { holderCount: { increment: 1 } },
      });
    }

    const newSupply = market.supplyUnits + quote.units;
    const updated = await tx.creatorMarket.update({
      where: { id: marketId },
      data: {
        supplyUnits: newSupply,
        priceCents: spotPriceCents(market, newSupply),
        volumeTotalCents: { increment: BigInt(chargedCents) },
      },
    });
    // Graduation gate (PRD §9.6 stages, §0A.7.5): once volume + holders clear
    // the tier-1 thresholds, the market graduates — a public milestone and the
    // hook for post-graduation maker rewards.
    if (
      updated.status === "GENESIS_CURVE" &&
      updated.volumeTotalCents >= BigInt(config.graduation.volumeCents) &&
      updated.holderCount >= config.graduation.holderCount
    ) {
      assertTransition("market", MARKET_TRANSITIONS, updated.status, "GRADUATION");
      await tx.creatorMarket.update({ where: { id: marketId }, data: { status: "GRADUATION" } });
      await emitEvent(tx, {
        type: "CREATOR_MILESTONE",
        creatorId: market.creatorId,
        message: `$${market.ticker} graduated — ${market.creator.displayName}'s market cleared ${config.graduation.holderCount}+ holders`,
      });
    }
    const marketTx = await tx.marketTransaction.create({
      data: {
        creatorMarketId: marketId,
        userId,
        side: "BUY",
        units: quote.units,
        grossCents: chargedCents,
        feeBreakdown: quote.fees as unknown as Prisma.InputJsonValue,
        priceAfterCents: updated.priceCents,
        ledgerTxId,
      },
    });
    await audit(tx, {
      actorId: userId,
      action: "CURVE_BUY",
      objectType: "CreatorMarket",
      objectId: marketId,
      after: { units: quote.units, chargedCents },
    });
    await emitEvent(tx, {
      type: "USER_BACKED",
      actorId: userId,
      creatorId: market.creatorId,
      message: `Someone backed ${market.creator.displayName}`,
      metadata: { units: quote.units },
    });
    return { marketTx, quote, chargedCents };
  });
}

export async function sell(userId: string, marketId: string, units: number) {
  if (!Number.isInteger(units) || units <= 0) throw new DomainError("BAD_AMOUNT", "Units must be positive");
  return prisma.$transaction(async (tx) => {
    const market = await tx.creatorMarket.findUnique({
      where: { id: marketId },
      include: { creator: true },
    });
    if (!market) throw notFound("Market");
    if (!TRADEABLE.includes(market.status)) {
      throw new DomainError("MARKET_NOT_OPEN", `Market is ${market.status.replaceAll("_", " ").toLowerCase()}`);
    }
    const holding = await tx.holding.findUnique({
      where: { userId_creatorMarketId: { userId, creatorMarketId: marketId } },
    });
    if (!holding || holding.amountUnits < units) {
      throw new DomainError("INSUFFICIENT_UNITS", "You do not hold that many units");
    }

    const quote = quoteSell(market, units);
    const ledgerTxId = await postLedgerTx(
      tx,
      "CURVE_TRADE",
      [
        { account: "MARKET_RESERVE", deltaCents: -quote.grossCents, creatorId: market.creatorId },
        { account: "EXTERNAL", deltaCents: quote.netCents, userId },
        { account: "CREATOR_EARNED", deltaCents: quote.fees.creatorFeeCents, creatorId: market.creatorId },
        { account: "PLATFORM_FEES", deltaCents: quote.fees.protocolFeeCents },
        { account: "SCOUT_REWARDS", deltaCents: quote.fees.scoutFeeCents, creatorId: market.creatorId },
      ],
      { kind: "curve_sell", marketId, units },
    );

    // Backer rank is permanent proof-of-early — selling keeps the rank row.
    await tx.holding.update({
      where: { id: holding.id },
      data: { amountUnits: holding.amountUnits - units },
    });
    if (holding.amountUnits - units === 0) {
      await tx.creatorMarket.update({
        where: { id: marketId },
        data: { holderCount: { decrement: 1 } },
      });
    }

    const newSupply = market.supplyUnits - units;
    const updated = await tx.creatorMarket.update({
      where: { id: marketId },
      data: {
        supplyUnits: newSupply,
        priceCents: spotPriceCents(market, newSupply),
        volumeTotalCents: { increment: BigInt(quote.grossCents) },
      },
    });
    const marketTx = await tx.marketTransaction.create({
      data: {
        creatorMarketId: marketId,
        userId,
        side: "SELL",
        units,
        grossCents: quote.grossCents,
        feeBreakdown: quote.fees as unknown as Prisma.InputJsonValue,
        priceAfterCents: updated.priceCents,
        ledgerTxId,
      },
    });
    await audit(tx, {
      actorId: userId,
      action: "CURVE_SELL",
      objectType: "CreatorMarket",
      objectId: marketId,
      after: { units, netCents: quote.netCents },
    });
    return { marketTx, quote };
  });
}

/**
 * Genesis Pass purchase (PRD §9.5, §12.2 primary sale 80/12/8).
 * One per user per creator; permanent backer number → Backer Wall.
 */
export async function purchaseGenesisPass(userId: string, creatorId: string, tierCents: number) {
  if (!config.backTiersCents.includes(tierCents as never) && tierCents < 500) {
    throw new DomainError("BAD_TIER", "Pick a pass tier of at least $5");
  }
  const auth = await paymentProvider.authorize({ userId, amountCents: tierCents, purpose: "genesis_pass" });
  await paymentProvider.capture(auth.authRef);
  return prisma.$transaction(async (tx) =>
    issueGenesisPassInTx(tx, userId, creatorId, tierCents),
  );
}

/** Shared with auction settlement — must run inside a transaction. */
export async function issueGenesisPassInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  creatorId: string,
  tierCents: number,
) {
  const creator = await tx.creator.findUnique({ where: { id: creatorId } });
  if (!creator) throw notFound("Creator");
  if (creator.status !== "LIVE" && creator.status !== "LAUNCHING_SOON") {
    throw new DomainError("NOT_LIVE", "Genesis Passes are only sold for launched creators");
  }
  const existing = await tx.genesisPass.findUnique({
    where: { userId_creatorId: { userId, creatorId } },
  });
  if (existing) throw new DomainError("ALREADY_PASSED", "You already hold this Genesis Pass");

  const creatorCents = Math.floor((tierCents * config.primarySale.creatorBps) / 10_000);
  const scoutCents = Math.floor((tierCents * config.primarySale.scoutBps) / 10_000);
  const platformCents = tierCents - creatorCents - scoutCents;
  const ledgerTxId = await postLedgerTx(
    tx,
    "AUCTION_FILL",
    [
      { account: "EXTERNAL", deltaCents: -tierCents, userId },
      { account: "CREATOR_EARNED", deltaCents: creatorCents, creatorId },
      { account: "PLATFORM_FEES", deltaCents: platformCents },
      { account: "SCOUT_REWARDS", deltaCents: scoutCents, creatorId },
    ],
    { kind: "genesis_pass", creatorId, tierCents },
  );

  const max = await tx.genesisPass.aggregate({
    where: { creatorId },
    _max: { backerNumber: true },
  });
  const backerNumber = (max._max.backerNumber ?? 0) + 1;
  const pass = await tx.genesisPass.create({
    data: { userId, creatorId, tierCents, backerNumber, ledgerTxId },
  });
  await tx.userBadge.create({
    data: {
      userId,
      badgeType: "GENESIS_BACKER",
      label: `Genesis Backer #${backerNumber} — ${creator.displayName}`,
      sourceRef: creatorId,
    },
  });
  return pass;
}

// ── Admin controls (PRD §9.6 pause capability) ──

export async function pauseMarket(adminId: string, marketId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const market = await tx.creatorMarket.findUnique({ where: { id: marketId } });
    if (!market) throw notFound("Market");
    assertTransition("market", MARKET_TRANSITIONS, market.status, "PAUSED");
    await tx.creatorMarket.update({
      where: { id: marketId },
      data: { status: "PAUSED", pausedReason: reason },
    });
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: "MARKET_PAUSED",
      objectType: "CreatorMarket",
      objectId: marketId,
      after: { reason },
    });
  });
}

export async function resumeMarket(adminId: string, marketId: string) {
  return prisma.$transaction(async (tx) => {
    const market = await tx.creatorMarket.findUnique({ where: { id: marketId } });
    if (!market) throw notFound("Market");
    assertTransition("market", MARKET_TRANSITIONS, market.status, "GENESIS_CURVE");
    await tx.creatorMarket.update({
      where: { id: marketId },
      data: { status: "GENESIS_CURVE", pausedReason: null },
    });
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: "MARKET_RESUMED",
      objectType: "CreatorMarket",
      objectId: marketId,
    });
  });
}

/** Data for the live creator page market module. */
export async function marketOverview(marketId: string) {
  const [transactions, topHoldings, wall] = await Promise.all([
    prisma.marketTransaction.findMany({
      where: { creatorMarketId: marketId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: { select: { username: true } } },
    }),
    prisma.holding.findMany({
      where: { creatorMarketId: marketId, amountUnits: { gt: 0 } },
      orderBy: { amountUnits: "desc" },
      take: 10,
      include: { user: { select: { username: true, displayName: true } } },
    }),
    prisma.holding.findMany({
      where: { creatorMarketId: marketId, backerRank: { not: null } },
      orderBy: { backerRank: "asc" },
      take: config.genesisWallSize,
      include: { user: { select: { username: true } } },
    }),
  ]);
  return { transactions, topHoldings, wall };
}
