import { prisma, type IntentType, type Prisma } from "@famerace/db";
import { z } from "zod";
import { config } from "../config";
import { DomainError, notFound } from "../errors";
import { paymentProvider } from "../payments";
import { audit } from "../statemachine";

// Fan Demand Orders (PRD §0A.3, §9A.3): pre-launch intent that never pays
// the creator before an official launch. Lifecycle:
//   SOFT_INTENT → REFUNDABLE_PLEDGE (payment hold) → CONFIRMED (window)
//   → captured by the opening auction, or expired/declined/refunded.

export const placeOrderSchema = z.object({
  draftProfileId: z.string().min(1),
  intentType: z.enum(["GENESIS_PASS", "MISSION_PLEDGE", "MARKET_BUY", "BACKSTAGE"]),
  amountCents: z
    .number()
    .int()
    .min(500, "Minimum pledge is $5")
    .max(1_000_000, "Maximum pledge is $10,000"),
  binding: z.boolean().default(true),
});

/** Sum of active (pledged) demand for a draft profile, for the vault display. */
async function recomputeDraftDemand(tx: Prisma.TransactionClient, draftProfileId: string) {
  const agg = await tx.fanDemandOrder.aggregate({
    where: {
      draftProfileId,
      confirmationStatus: { not: "DECLINED" },
      refundStatus: "NONE",
      expiresAt: { gt: new Date() },
    },
    _sum: { amountCents: true },
  });
  await tx.draftProfile.update({
    where: { id: draftProfileId },
    data: { pledgedDemandTotal: agg._sum.amountCents ?? 0 },
  });
}

export async function placeDemandOrder(userId: string, input: z.input<typeof placeOrderSchema>) {
  const data = placeOrderSchema.parse(input);

  const profile = await prisma.draftProfile.findUnique({ where: { id: data.draftProfileId } });
  if (!profile || profile.moderationStatus !== "APPROVED") throw notFound("Draft profile");
  if (profile.claimStatus === "CLAIMED") {
    throw new DomainError("ALREADY_LIVE", "This creator has launched — back them on their live profile");
  }

  // Refundable pledge places a payment hold before the DB write; the hold is
  // provider-side only until launch (PRD §0A.3: money does not go to the
  // creator until the official launch).
  const auth = data.binding
    ? await paymentProvider.authorize({
        userId,
        amountCents: data.amountCents,
        purpose: "demand_pledge",
      })
    : null;

  return prisma.$transaction(async (tx) => {
    const order = await tx.fanDemandOrder.create({
      data: {
        userId,
        draftProfileId: data.draftProfileId,
        intentType: data.intentType,
        amountCents: data.amountCents,
        bindingStatus: data.binding ? "REFUNDABLE_PLEDGE" : "SOFT_INTENT",
        paymentAuthStatus: auth ? "AUTHORIZED" : "NONE",
        paymentAuthRef: auth?.authRef ?? null,
        expiresAt: new Date(Date.now() + config.demandOrderTtlDays * 24 * 3600 * 1000),
      },
    });
    await recomputeDraftDemand(tx, data.draftProfileId);
    // Watching follows pledging: pledgers join the fan count if not already in.
    const watching = await tx.rosterEntry.findUnique({
      where: { userId_draftProfileId: { userId, draftProfileId: data.draftProfileId } },
    });
    if (!watching) {
      await tx.rosterEntry.create({
        data: { userId, draftProfileId: data.draftProfileId, source: "WATCHING" },
      });
      await tx.draftProfile.update({
        where: { id: data.draftProfileId },
        data: { fanCount: { increment: 1 } },
      });
    }
    await audit(tx, {
      actorId: userId,
      action: "DEMAND_ORDER_PLACED",
      objectType: "FanDemandOrder",
      objectId: order.id,
      after: { intentType: order.intentType, amountCents: order.amountCents, binding: data.binding },
    });
    return order;
  });
}

/** Cancel an order the user placed (any time before it is captured). */
export async function cancelDemandOrder(userId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.fanDemandOrder.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw notFound("Demand order");
    if (order.paymentAuthStatus === "CAPTURED") {
      throw new DomainError("ALREADY_CAPTURED", "This order was already filled at launch");
    }
    if (order.paymentAuthStatus === "AUTHORIZED" && order.paymentAuthRef) {
      await paymentProvider.release(order.paymentAuthRef);
    }
    await tx.fanDemandOrder.update({
      where: { id: order.id },
      data: {
        confirmationStatus: "DECLINED",
        paymentAuthStatus: order.paymentAuthStatus === "AUTHORIZED" ? "RELEASED" : order.paymentAuthStatus,
        refundStatus: order.bindingStatus === "SOFT_INTENT" ? "NONE" : "REFUNDED",
      },
    });
    if (order.draftProfileId) await recomputeDraftDemand(tx, order.draftProfileId);
    await audit(tx, {
      actorId: userId,
      action: "DEMAND_ORDER_CANCELED",
      objectType: "FanDemandOrder",
      objectId: order.id,
    });
  });
}

/**
 * Open the final confirmation window for a creator's orders (PRD §0A.4 step 2).
 * Runs when a launch is scheduled; holders confirm or decline before the auction.
 */
export async function openConfirmationWindow(creatorId: string) {
  await prisma.fanDemandOrder.updateMany({
    where: {
      creatorId,
      confirmationStatus: "UNCONFIRMED",
      refundStatus: "NONE",
      expiresAt: { gt: new Date() },
    },
    data: { confirmationStatus: "CONFIRMATION_WINDOW" },
  });
}

export async function confirmDemandOrder(userId: string, orderId: string) {
  const order = await prisma.fanDemandOrder.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw notFound("Demand order");
  if (order.confirmationStatus !== "CONFIRMATION_WINDOW") {
    throw new DomainError("NOT_IN_WINDOW", "This order is not in its confirmation window");
  }
  return prisma.fanDemandOrder.update({
    where: { id: orderId },
    data: { confirmationStatus: "CONFIRMED" },
  });
}

/** Expiry sweep (PRD §0A.3: if the creator does not claim, intent expires). */
export async function expireStaleOrders(): Promise<number> {
  const stale = await prisma.fanDemandOrder.findMany({
    where: {
      expiresAt: { lte: new Date() },
      paymentAuthStatus: { in: ["NONE", "AUTHORIZED"] },
      confirmationStatus: { not: "DECLINED" },
    },
    select: { id: true, paymentAuthStatus: true, paymentAuthRef: true, draftProfileId: true },
  });
  for (const order of stale) {
    if (order.paymentAuthStatus === "AUTHORIZED" && order.paymentAuthRef) {
      await paymentProvider.release(order.paymentAuthRef);
    }
    await prisma.fanDemandOrder.update({
      where: { id: order.id },
      data: {
        confirmationStatus: "DECLINED",
        paymentAuthStatus: order.paymentAuthStatus === "AUTHORIZED" ? "RELEASED" : "NONE",
        refundStatus: order.paymentAuthStatus === "AUTHORIZED" ? "REFUNDED" : "NONE",
      },
    });
  }
  const profiles = [...new Set(stale.map((o) => o.draftProfileId).filter((x): x is string => !!x))];
  await prisma.$transaction(async (tx) => {
    for (const id of profiles) await recomputeDraftDemand(tx, id);
  });
  return stale.length;
}

export type DemandSummary = {
  totalCents: number;
  orderCount: number;
  backerCount: number;
  byIntent: Partial<Record<IntentType, number>>;
};

export async function demandSummary(where: { draftProfileId?: string; creatorId?: string }): Promise<DemandSummary> {
  const filter: Prisma.FanDemandOrderWhereInput = {
    ...(where.draftProfileId ? { draftProfileId: where.draftProfileId } : {}),
    ...(where.creatorId ? { creatorId: where.creatorId } : {}),
    confirmationStatus: { not: "DECLINED" },
    refundStatus: "NONE",
    expiresAt: { gt: new Date() },
  };
  const orders = await prisma.fanDemandOrder.findMany({
    where: filter,
    select: { userId: true, amountCents: true, intentType: true },
  });
  const byIntent: Partial<Record<IntentType, number>> = {};
  for (const o of orders) {
    byIntent[o.intentType] = (byIntent[o.intentType] ?? 0) + o.amountCents;
  }
  return {
    totalCents: orders.reduce((sum, o) => sum + o.amountCents, 0),
    orderCount: orders.length,
    backerCount: new Set(orders.map((o) => o.userId)).size,
    byIntent,
  };
}

/** Orders owned by a user, for roster/profile surfaces. */
export async function ordersForUser(userId: string) {
  return prisma.fanDemandOrder.findMany({
    where: { userId },
    include: {
      draftProfile: { select: { id: true, nameOrHandle: true } },
      creator: { select: { id: true, handle: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
