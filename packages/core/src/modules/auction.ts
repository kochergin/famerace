import { prisma, type Prisma } from "@famerace/db";
import { clearBatchAuction, spotPriceCents } from "../curve";
import { DomainError, notFound } from "../errors";
import { emitEvent } from "../events";
import { paymentProvider } from "../payments";
import { assertTransition, audit, AUCTION_TRANSITIONS, CREATOR_TRANSITIONS, MARKET_TRANSITIONS } from "../statemachine";
import { notify } from "./notify";
import { postLedgerTx } from "./ledger";
import { issueGenesisPassInTx } from "./market";

// Opening Batch Auction (PRD §9A.5, §0A.4): confirmed pre-launch orders clear
// through one fair mechanism, then the live curve starts from the cleared
// supply. Intent handling at settlement:
//   MARKET_BUY    → batch fill on the curve (proportional, largest remainder)
//   GENESIS_PASS  → primary-sale pass issue (80/12/8 split, backer number)
//   MISSION_PLEDGE→ stays captured-later: converts when the mission goes live
//   BACKSTAGE     → hold released; user is prompted to subscribe post-launch

/** Settle every auction whose end time has passed. Idempotent sweep. */
export async function settleDueLaunches(now = new Date()): Promise<number> {
  const due = await prisma.openingAuction.findMany({
    where: { status: "COLLECTING", endTime: { lte: now } },
    select: { id: true },
  });
  for (const auction of due) {
    await settleAuction(auction.id);
  }
  return due.length;
}

export async function settleAuction(auctionId: string): Promise<void> {
  // Mark CLEARING first (separate tx) so concurrent sweeps skip this auction.
  const claimed = await prisma.openingAuction.updateMany({
    where: { id: auctionId, status: "COLLECTING" },
    data: { status: "CLEARING" },
  });
  if (claimed.count === 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      const auction = await tx.openingAuction.findUnique({
        where: { id: auctionId },
        include: { market: { include: { creator: true } } },
      });
      if (!auction) throw notFound("Auction");
      assertTransition("auction", AUCTION_TRANSITIONS, auction.status, "SETTLED");
      const market = auction.market;
      const creator = market.creator;

      const orders = await tx.fanDemandOrder.findMany({
        where: {
          creatorId: creator.id,
          refundStatus: "NONE",
          paymentAuthStatus: "AUTHORIZED",
          confirmationStatus: { in: ["CONFIRMED", "CONFIRMATION_WINDOW"] },
        },
        orderBy: { createdAt: "asc" },
      });

      // 1. Curve batch fill for MARKET_BUY intents.
      const buyOrders = orders.filter((o) => o.intentType === "MARKET_BUY");
      const clearing = clearBatchAuction(market, buyOrders.map((o) => ({ id: o.id, amountCents: o.amountCents })));
      const fillByOrder = new Map(clearing.fills.map((f) => [f.id, f]));

      let reserveCents = 0;
      for (const order of buyOrders) {
        const fill = fillByOrder.get(order.id);
        const units = fill?.units ?? 0;
        if (units === 0) {
          await releaseOrder(tx, order.id, order.paymentAuthRef);
          continue;
        }
        await paymentProvider.capture(order.paymentAuthRef ?? "");
        // Charge exactly the proportional cost share; remainder of the pledge releases.
        const shareCents = Math.min(
          order.amountCents,
          Math.ceil((clearing.totalSpentCents * order.amountCents) / Math.max(1, clearing.fills.reduce((s, f) => s + f.amountCents, 0))),
        );
        reserveCents += shareCents;
        await postLedgerTx(
          tx,
          "AUCTION_FILL",
          [
            { account: "EXTERNAL", deltaCents: -shareCents, userId: order.userId },
            { account: "MARKET_RESERVE", deltaCents: shareCents, creatorId: creator.id },
          ],
          { kind: "auction_curve_fill", auctionId, orderId: order.id, units },
        );
        await tx.auctionOrder.create({
          data: {
            auctionId,
            userId: order.userId,
            demandOrderId: order.id,
            amountCents: shareCents,
            fillUnits: units,
            fillAmountCents: shareCents,
            status: "FILLED",
          },
        });
        await tx.fanDemandOrder.update({
          where: { id: order.id },
          data: { paymentAuthStatus: "CAPTURED", confirmationStatus: "CONFIRMED" },
        });
        await upsertHolding(tx, order.userId, market.id, units, shareCents);
      }

      // 2. Genesis Pass issues for GENESIS_PASS intents (backer numbers in
      //    pledge order — earliest believers get the lowest numbers).
      const passOrders = orders.filter((o) => o.intentType === "GENESIS_PASS");
      for (const order of passOrders) {
        await paymentProvider.capture(order.paymentAuthRef ?? "");
        await issueGenesisPassInTx(tx, order.userId, creator.id, order.amountCents);
        await tx.fanDemandOrder.update({
          where: { id: order.id },
          data: { paymentAuthStatus: "CAPTURED", confirmationStatus: "CONFIRMED" },
        });
        await tx.auctionOrder.create({
          data: {
            auctionId,
            userId: order.userId,
            demandOrderId: order.id,
            amountCents: order.amountCents,
            fillAmountCents: order.amountCents,
            status: "FILLED",
          },
        });
      }

      // 3. Backstage intents: release the hold, nudge to subscribe.
      const backstageOrders = orders.filter((o) => o.intentType === "BACKSTAGE");
      for (const order of backstageOrders) {
        await releaseOrder(tx, order.id, order.paymentAuthRef);
        await notify(tx, {
            userId: order.userId,
            type: "LAUNCH_STARTING",
            title: `${creator.displayName} is live — Backstage is open`,
            body: "Your Backstage pledge hold was released. Subscribe to unlock the feed.",
            link: `/c/${creator.handle}`,
          });
      }
      // MISSION_PLEDGE orders stay AUTHORIZED — the missions module converts
      // them into escrowed contributions when the mission goes live.

      // 4. Market goes live from the cleared supply.
      const supply = clearing.totalUnits;
      assertTransition("market", MARKET_TRANSITIONS, market.status, "GENESIS_CURVE");
      await tx.creatorMarket.update({
        where: { id: market.id },
        data: {
          status: "GENESIS_CURVE",
          supplyUnits: supply,
          priceCents: spotPriceCents(market, supply),
          volumeTotalCents: { increment: reserveCents },
          holderCount: new Set(buyOrders.filter((o) => (fillByOrder.get(o.id)?.units ?? 0) > 0).map((o) => o.userId)).size,
          launchTime: new Date(),
        },
      });
      await tx.openingAuction.update({
        where: { id: auctionId },
        data: {
          status: "SETTLED",
          clearingPriceCents: clearing.clearingPriceCents,
          clearingResult: {
            totalUnits: clearing.totalUnits,
            totalSpentCents: clearing.totalSpentCents,
            buyOrders: buyOrders.length,
            passOrders: passOrders.length,
            backstageReleased: backstageOrders.length,
          },
          launchedAt: new Date(),
        },
      });

      assertTransition("creator", CREATOR_TRANSITIONS, creator.status, "LIVE");
      await tx.creator.update({ where: { id: creator.id }, data: { status: "LIVE" } });
      await tx.launchThreshold.updateMany({ where: { creatorId: creator.id }, data: { status: "LIVE" } });
      await tx.draftProfile.updateMany({
        where: { id: creator.draftProfileId ?? "" },
        data: { claimStatus: "CLAIMED" },
      });

      // Backers of record → roster (source BACKED) + launch notifications.
      const backerIds = new Set([...buyOrders, ...passOrders].map((o) => o.userId));
      for (const userId of backerIds) {
        await tx.rosterEntry.upsert({
          where: { userId_creatorId: { userId, creatorId: creator.id } },
          create: { userId, creatorId: creator.id, source: "BACKED" },
          update: { source: "BACKED" },
        });
        await notify(tx, {
            userId,
            type: "AUCTION_CONFIRMATION",
            title: `${creator.displayName} launched — your opening order filled`,
            link: `/c/${creator.handle}`,
          });
      }

      await audit(tx, {
        actorType: "SYSTEM",
        action: "AUCTION_SETTLED",
        objectType: "OpeningAuction",
        objectId: auctionId,
        after: { totalUnits: clearing.totalUnits, totalSpentCents: clearing.totalSpentCents },
      });
      await emitEvent(tx, {
        type: "AUCTION_SETTLED",
        creatorId: creator.id,
        message: `${creator.displayName}'s opening confirmed with ${orders.length} backers`,
      });
      await emitEvent(tx, {
        type: "MARKET_LAUNCHED",
        creatorId: creator.id,
        message: `${creator.displayName} is LIVE — the curve is open`,
      });
    }, { timeout: 30_000 });
  } catch (error) {
    await prisma.openingAuction.update({
      where: { id: auctionId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

async function releaseOrder(tx: Prisma.TransactionClient, orderId: string, authRef: string | null) {
  if (authRef) await paymentProvider.release(authRef);
  await tx.fanDemandOrder.update({
    where: { id: orderId },
    data: { paymentAuthStatus: "RELEASED", refundStatus: "REFUNDED" },
  });
}

async function upsertHolding(
  tx: Prisma.TransactionClient,
  userId: string,
  creatorMarketId: string,
  units: number,
  costCents: number,
) {
  const existing = await tx.holding.findUnique({
    where: { userId_creatorMarketId: { userId, creatorMarketId } },
  });
  if (existing) {
    const total = existing.amountUnits + units;
    await tx.holding.update({
      where: { id: existing.id },
      data: {
        amountUnits: total,
        avgEntryCents: Math.round((existing.avgEntryCents * existing.amountUnits + costCents) / total),
      },
    });
    return;
  }
  const max = await tx.holding.aggregate({ where: { creatorMarketId }, _max: { backerRank: true } });
  await tx.holding.create({
    data: {
      userId,
      creatorMarketId,
      amountUnits: units,
      avgEntryCents: Math.max(1, Math.round(costCents / units)),
      backerRank: (max._max.backerRank ?? 0) + 1,
      isGenesis: true,
    },
  });
}

/** Creators in the Launching Soon window, for the countdown page. */
export async function launchingSoon() {
  return prisma.creator.findMany({
    where: { status: "LAUNCHING_SOON" },
    include: {
      market: { include: { auction: true } },
      launchThreshold: true,
    },
    orderBy: { launchAt: "asc" },
  });
}

/** A user's orders sitting in a confirmation window. */
export async function ordersInWindow(userId: string) {
  return prisma.fanDemandOrder.findMany({
    where: { userId, confirmationStatus: "CONFIRMATION_WINDOW", refundStatus: "NONE" },
    include: { creator: { select: { handle: true, displayName: true, launchAt: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Manual trigger for an admin "launch now" action. */
export async function launchNow(adminId: string, creatorId: string) {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: { market: { include: { auction: true } } },
  });
  if (!creator?.market?.auction) throw notFound("Scheduled launch");
  if (creator.market.auction.status !== "COLLECTING") {
    throw new DomainError("NOT_COLLECTING", "Auction is not collecting");
  }
  await audit(prisma, {
    actorId: adminId,
    actorType: "ADMIN",
    action: "LAUNCH_NOW",
    objectType: "OpeningAuction",
    objectId: creator.market.auction.id,
  });
  await settleAuction(creator.market.auction.id);
}
