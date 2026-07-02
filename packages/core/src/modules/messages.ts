import { prisma } from "@famerace/db";
import { z } from "zod";
import { config } from "../config";
import { DomainError, notFound } from "../errors";
import { paymentProvider } from "../payments";
import { audit } from "../statemachine";
import { postLedgerTx } from "./ledger";
import { notify } from "./notify";
import { enforceProhibited, isBlocked } from "./safety";

// Paid Messages / Backer Inbox (PRD §9.10): a fan pays to put a message in
// front of the creator. Money sits in CREATOR_PENDING until the creator
// responds (80/20 split) or rejects (full auto-refund). Clear refund policy:
// no response = refundable, response = earned.

export const sendSchema = z.object({
  creatorId: z.string().min(1),
  priceCents: z.number().int().min(500, "Minimum paid message is $5").max(100_000),
  body: z.string().min(10, "Say something worth their time (10+ characters)").max(2000),
});

export async function sendPaidMessage(userId: string, input: z.input<typeof sendSchema>) {
  const data = sendSchema.parse(input);
  const creator = await prisma.creator.findUnique({ where: { id: data.creatorId } });
  if (!creator || creator.status !== "LIVE") throw notFound("Creator");
  if (creator.userId && (await isBlocked(creator.userId, userId))) {
    throw new DomainError("BLOCKED", "You cannot message this creator");
  }
  enforceProhibited("message", data.body); // abuse controls (§9.10)

  const auth = await paymentProvider.authorize({ userId, amountCents: data.priceCents, purpose: "paid_message" });
  await paymentProvider.capture(auth.authRef);

  return prisma.$transaction(async (tx) => {
    const ledgerTxId = await postLedgerTx(
      tx,
      "MESSAGE_FEE",
      [
        { account: "EXTERNAL", deltaCents: -data.priceCents, userId },
        { account: "CREATOR_PENDING", deltaCents: data.priceCents, creatorId: creator.id },
      ],
      { kind: "paid_message_hold" },
    );
    const message = await tx.paidMessage.create({
      data: {
        fromUserId: userId,
        creatorId: creator.id,
        priceCents: data.priceCents,
        body: data.body,
        ledgerTxId,
      },
    });
    if (creator.userId) {
      await notify(tx, {
        userId: creator.userId,
        type: "PAYOUT_UPDATE",
        title: "New paid message in your inbox",
        body: `$${(data.priceCents / 100).toFixed(0)} — respond to earn it, reject to refund it.`,
        link: "/dashboard/inbox",
      });
    }
    await audit(tx, { actorId: userId, action: "PAID_MESSAGE_SENT", objectType: "PaidMessage", objectId: message.id });
    return message;
  });
}

/** Creator responds: pending amount splits 80/20 creator/platform (§12.2). */
export async function respondToMessage(creatorUserId: string, messageId: string, response: string) {
  if (response.trim().length < 2) throw new DomainError("EMPTY_RESPONSE", "Write a response first");
  return prisma.$transaction(async (tx) => {
    const message = await tx.paidMessage.findUnique({
      where: { id: messageId },
      include: { creator: true },
    });
    if (!message || message.creator.userId !== creatorUserId) throw notFound("Message");
    if (message.status !== "SENT" && message.status !== "ACCEPTED") {
      throw new DomainError("ALREADY_HANDLED", `Message is already ${message.status.toLowerCase()}`);
    }
    const creatorCents = Math.floor((message.priceCents * config.paidMessages.creatorBps) / 10_000);
    await postLedgerTx(
      tx,
      "MESSAGE_FEE",
      [
        { account: "CREATOR_PENDING", deltaCents: -message.priceCents, creatorId: message.creatorId },
        { account: "CREATOR_EARNED", deltaCents: creatorCents, creatorId: message.creatorId },
        { account: "PLATFORM_FEES", deltaCents: message.priceCents - creatorCents },
      ],
      { kind: "paid_message_earned", messageId },
    );
    const updated = await tx.paidMessage.update({
      where: { id: messageId },
      data: { status: "RESPONDED", response: response.trim() },
    });
    await notify(tx, {
      userId: message.fromUserId,
      type: "PAYOUT_UPDATE",
      title: `${message.creator.displayName} responded to your message`,
      body: response.slice(0, 140),
      link: `/c/${message.creator.handle}`,
    });
    await audit(tx, {
      actorId: creatorUserId,
      action: "PAID_MESSAGE_RESPONDED",
      objectType: "PaidMessage",
      objectId: messageId,
    });
    return updated;
  });
}

/** Creator rejects: full refund from pending (§9.10 clear refund policy). */
export async function rejectMessage(creatorUserId: string, messageId: string) {
  const result = await rejectMessageInner(creatorUserId, messageId);
  await paymentProvider.payout({
    userId: result.fromUserId,
    amountCents: result.priceCents,
    memo: "Paid message declined — refund",
  });
  return result;
}

async function rejectMessageInner(creatorUserId: string, messageId: string) {
  return prisma.$transaction(async (tx) => {
    const message = await tx.paidMessage.findUnique({
      where: { id: messageId },
      include: { creator: true },
    });
    if (!message || message.creator.userId !== creatorUserId) throw notFound("Message");
    if (message.status !== "SENT") {
      throw new DomainError("ALREADY_HANDLED", `Message is already ${message.status.toLowerCase()}`);
    }
    await postLedgerTx(
      tx,
      "REFUND",
      [
        { account: "CREATOR_PENDING", deltaCents: -message.priceCents, creatorId: message.creatorId },
        { account: "EXTERNAL", deltaCents: message.priceCents, userId: message.fromUserId },
      ],
      { kind: "paid_message_refund", messageId },
    );
    const updated = await tx.paidMessage.update({
      where: { id: messageId },
      data: { status: "REFUNDED" },
    });
    await notify(tx, {
      userId: message.fromUserId,
      type: "PAYOUT_UPDATE",
      title: `Your paid message was declined — full refund issued`,
      link: `/c/${message.creator.handle}`,
    });
    await audit(tx, {
      actorId: creatorUserId,
      action: "PAID_MESSAGE_REJECTED",
      objectType: "PaidMessage",
      objectId: messageId,
    });
    return updated;
  });
}

export async function inboxFor(creatorId: string) {
  return prisma.paidMessage.findMany({
    where: { creatorId },
    include: { fromUser: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function sentMessages(userId: string) {
  return prisma.paidMessage.findMany({
    where: { fromUserId: userId },
    include: { creator: { select: { displayName: true, handle: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
