import { prisma } from "@famerace/db";
import { z } from "zod";
import { DomainError, notFound } from "../errors";
import { paymentProvider } from "../payments";
import { audit } from "../statemachine";
import { postLedgerTx } from "./ledger";
import { notify } from "./notify";

// Creator Request Menu (PRD §9.11): high-ticket items — private listening
// party, portfolio review, custom shoutout. Payment escrows in
// CREATOR_PENDING; delivery moves it to CREATOR_EARNED (85/15); the creator
// can refund any time before delivery.

const REQUEST_PLATFORM_BPS = 1_500;

export const itemSchema = z.object({
  title: z.string().min(4).max(120),
  priceCents: z.number().int().min(1_000, "Minimum request price is $10").max(10_000_000),
  deliveryDays: z.number().int().min(1).max(60),
});

export async function configureItem(userId: string, input: z.input<typeof itemSchema>) {
  const data = itemSchema.parse(input);
  const creator = await prisma.creator.findFirst({ where: { userId } });
  if (!creator) throw notFound("Creator profile");
  return prisma.creatorRequestItem.create({
    data: {
      creatorId: creator.id,
      title: data.title,
      priceCents: data.priceCents,
      deliveryDays: data.deliveryDays,
    },
  });
}

export async function setItemAvailability(userId: string, itemId: string, available: boolean) {
  const item = await prisma.creatorRequestItem.findUnique({
    where: { id: itemId },
    include: { creator: true },
  });
  if (!item || item.creator.userId !== userId) throw notFound("Request item");
  return prisma.creatorRequestItem.update({ where: { id: itemId }, data: { available } });
}

export async function orderItem(userId: string, itemId: string) {
  const item = await prisma.creatorRequestItem.findUnique({
    where: { id: itemId },
    include: { creator: true },
  });
  if (!item || !item.available) throw notFound("Request item");
  if (item.creator.status !== "LIVE") throw new DomainError("NOT_LIVE", "Requests open when the creator is live");

  const auth = await paymentProvider.authorize({ userId, amountCents: item.priceCents, purpose: "request" });
  await paymentProvider.capture(auth.authRef);

  return prisma.$transaction(async (tx) => {
    const ledgerTxId = await postLedgerTx(
      tx,
      "MESSAGE_FEE",
      [
        { account: "EXTERNAL", deltaCents: -item.priceCents, userId },
        { account: "CREATOR_PENDING", deltaCents: item.priceCents, creatorId: item.creatorId },
      ],
      { kind: "request_escrow", itemId },
    );
    const order = await tx.requestOrder.create({
      data: { itemId, userId, status: "REQUESTED", ledgerTxId },
    });
    if (item.creator.userId) {
      await notify(tx, {
        userId: item.creator.userId,
        type: "PAYOUT_UPDATE",
        title: `New request: ${item.title}`,
        body: `Deliver within ${item.deliveryDays} days to earn $${(item.priceCents / 100).toFixed(0)}.`,
        link: "/dashboard/inbox",
      });
    }
    await audit(tx, { actorId: userId, action: "REQUEST_ORDERED", objectType: "RequestOrder", objectId: order.id });
    return order;
  });
}

export async function acceptOrder(creatorUserId: string, orderId: string) {
  return transitionOrder(creatorUserId, orderId, "REQUESTED", "ACCEPTED");
}

/** Delivery releases escrow: 85% creator / 15% platform. */
export async function deliverOrder(creatorUserId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.requestOrder.findUnique({
      where: { id: orderId },
      include: { item: { include: { creator: true } } },
    });
    if (!order || order.item.creator.userId !== creatorUserId) throw notFound("Request order");
    if (order.status !== "REQUESTED" && order.status !== "ACCEPTED") {
      throw new DomainError("BAD_STATE", `Order is ${order.status.toLowerCase()}`);
    }
    const price = order.item.priceCents;
    const platformCents = Math.floor((price * REQUEST_PLATFORM_BPS) / 10_000);
    await postLedgerTx(
      tx,
      "MESSAGE_FEE",
      [
        { account: "CREATOR_PENDING", deltaCents: -price, creatorId: order.item.creatorId },
        { account: "CREATOR_EARNED", deltaCents: price - platformCents, creatorId: order.item.creatorId },
        { account: "PLATFORM_FEES", deltaCents: platformCents },
      ],
      { kind: "request_delivered", orderId },
    );
    const updated = await tx.requestOrder.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
    await notify(tx, {
      userId: order.userId,
      type: "PAYOUT_UPDATE",
      title: `Delivered: ${order.item.title}`,
      body: `${order.item.creator.displayName} completed your request.`,
      link: `/c/${order.item.creator.handle}`,
    });
    await audit(tx, {
      actorId: creatorUserId,
      action: "REQUEST_DELIVERED",
      objectType: "RequestOrder",
      objectId: orderId,
    });
    return updated;
  });
}

/** Refund any undelivered order in full (§9.11 approval/refund workflow). */
export async function refundOrder(creatorUserId: string, orderId: string) {
  const updated = await refundOrderInner(creatorUserId, orderId);
  await paymentProvider.payout({
    userId: updated.userId,
    amountCents: updated.refundedCents,
    memo: "Request refunded",
  });
  return updated;
}

async function refundOrderInner(creatorUserId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.requestOrder.findUnique({
      where: { id: orderId },
      include: { item: { include: { creator: true } } },
    });
    if (!order || order.item.creator.userId !== creatorUserId) throw notFound("Request order");
    if (order.status === "DELIVERED" || order.status === "REFUNDED") {
      throw new DomainError("BAD_STATE", `Order is ${order.status.toLowerCase()}`);
    }
    await postLedgerTx(
      tx,
      "REFUND",
      [
        { account: "CREATOR_PENDING", deltaCents: -order.item.priceCents, creatorId: order.item.creatorId },
        { account: "EXTERNAL", deltaCents: order.item.priceCents, userId: order.userId },
      ],
      { kind: "request_refund", orderId },
    );
    const updated = await tx.requestOrder.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
    const refundShape = { ...updated, refundedCents: order.item.priceCents };
    await notify(tx, {
      userId: order.userId,
      type: "PAYOUT_UPDATE",
      title: `Refunded: ${order.item.title}`,
      link: `/c/${order.item.creator.handle}`,
    });
    return refundShape;
  });
}

async function transitionOrder(creatorUserId: string, orderId: string, from: string, to: string) {
  const order = await prisma.requestOrder.findUnique({
    where: { id: orderId },
    include: { item: { include: { creator: true } } },
  });
  if (!order || order.item.creator.userId !== creatorUserId) throw notFound("Request order");
  if (order.status !== from) throw new DomainError("BAD_STATE", `Order is ${order.status.toLowerCase()}`);
  return prisma.requestOrder.update({ where: { id: orderId }, data: { status: to } });
}

export async function menuFor(creatorId: string) {
  return prisma.creatorRequestItem.findMany({
    where: { creatorId, available: true },
    orderBy: { priceCents: "asc" },
  });
}

export async function ordersForCreator(creatorId: string) {
  return prisma.requestOrder.findMany({
    where: { item: { creatorId } },
    include: { item: { select: { title: true, priceCents: true } }, user: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
