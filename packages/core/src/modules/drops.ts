import { prisma } from "@famerace/db";
import { z } from "zod";
import { config } from "../config";
import { DomainError, notFound } from "../errors";
import { emitEvent } from "../events";
import { paymentProvider } from "../payments";
import { audit } from "../statemachine";
import { notify } from "./notify";
import { postLedgerTx } from "./ledger";
import { enforceProhibited } from "./safety";

// Paid Drops (PRD §9.8): one-off paid content with preview, quantity limit
// and the 85/10/5 creator/platform/scout split (§12.2).

export const dropSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(2000),
  previewText: z.string().max(240).optional().or(z.literal("")),
  mediaUrl: z.string().url().max(300).optional().or(z.literal("")),
  priceCents: z.number().int().min(100).max(1_000_000),
  quantityLimit: z.number().int().min(1).max(100_000).optional(),
});

export async function createDrop(userId: string, input: z.input<typeof dropSchema>) {
  const data = dropSchema.parse(input);
  enforceProhibited("drop", data.title, data.description, data.previewText);
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findFirst({ where: { userId } });
    if (!creator) throw notFound("Creator profile");
    if (creator.status !== "LIVE") throw new DomainError("NOT_LIVE", "Drops open when you are live");
    const drop = await tx.drop.create({
      data: {
        creatorId: creator.id,
        title: data.title,
        description: data.description,
        previewText: data.previewText || null,
        mediaUrl: data.mediaUrl || null,
        priceCents: data.priceCents,
        quantityLimit: data.quantityLimit ?? null,
        status: "LIVE",
      },
    });
    await emitEvent(tx, {
      type: "DROP_RELEASED",
      creatorId: creator.id,
      message: `${creator.displayName} released a paid drop: ${drop.title}`,
    });
    await audit(tx, { actorId: userId, action: "DROP_CREATED", objectType: "Drop", objectId: drop.id });
    return drop;
  });
}

export async function purchaseDrop(userId: string, dropId: string) {
  const drop = await prisma.drop.findUnique({ where: { id: dropId } });
  if (!drop || drop.status === "DRAFT" || drop.status === "REMOVED") throw notFound("Drop");
  if (drop.status === "SOLD_OUT") throw new DomainError("SOLD_OUT", "This drop is sold out");
  const auth = await paymentProvider.authorize({ userId, amountCents: drop.priceCents, purpose: "drop" });
  await paymentProvider.capture(auth.authRef);

  return prisma.$transaction(async (tx) => {
    const fresh = await tx.drop.findUniqueOrThrow({ where: { id: dropId } });
    if (fresh.status !== "LIVE") throw new DomainError("DROP_CLOSED", "This drop is no longer available");
    if (fresh.quantityLimit && fresh.soldCount >= fresh.quantityLimit) {
      throw new DomainError("SOLD_OUT", "This drop is sold out");
    }
    const existing = await tx.dropPurchase.findUnique({
      where: { dropId_userId: { dropId, userId } },
    });
    if (existing) throw new DomainError("ALREADY_OWNED", "You already unlocked this drop");

    const creatorCents = Math.floor((fresh.priceCents * config.drops.creatorBps) / 10_000);
    const scoutCents = Math.floor((fresh.priceCents * config.drops.scoutBps) / 10_000);
    const ledgerTxId = await postLedgerTx(
      tx,
      "DROP_SALE",
      [
        { account: "EXTERNAL", deltaCents: -fresh.priceCents, userId },
        { account: "CREATOR_EARNED", deltaCents: creatorCents, creatorId: fresh.creatorId },
        { account: "SCOUT_REWARDS", deltaCents: scoutCents, creatorId: fresh.creatorId },
        { account: "PLATFORM_FEES", deltaCents: fresh.priceCents - creatorCents - scoutCents },
      ],
      { kind: "drop_sale", dropId },
    );
    const purchase = await tx.dropPurchase.create({
      data: { dropId, userId, priceCents: fresh.priceCents, ledgerTxId },
    });
    const soldCount = fresh.soldCount + 1;
    await tx.drop.update({
      where: { id: dropId },
      data: {
        soldCount,
        revenueCents: { increment: fresh.priceCents },
        status: fresh.quantityLimit && soldCount >= fresh.quantityLimit ? "SOLD_OUT" : "LIVE",
      },
    });
    return purchase;
  });
}

export async function tip(userId: string, creatorId: string, amountCents: number, message?: string, isPublic = true) {
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw new DomainError("BAD_AMOUNT", "Minimum tip is $1");
  }
  const auth = await paymentProvider.authorize({ userId, amountCents, purpose: "tip" });
  await paymentProvider.capture(auth.authRef);
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findUnique({ where: { id: creatorId } });
    if (!creator || creator.status !== "LIVE") throw notFound("Creator");
    const creatorCents = Math.floor((amountCents * config.tips.creatorBps) / 10_000);
    const ledgerTxId = await postLedgerTx(
      tx,
      "TIP",
      [
        { account: "EXTERNAL", deltaCents: -amountCents, userId },
        { account: "CREATOR_EARNED", deltaCents: creatorCents, creatorId },
        { account: "PLATFORM_FEES", deltaCents: amountCents - creatorCents },
      ],
      { kind: "tip", creatorId },
    );
    const tipRow = await tx.tip.create({
      data: { fromUserId: userId, creatorId, amountCents, message: message || null, isPublic, ledgerTxId },
    });
    if (creator.userId) {
      await notify(tx, {
          userId: creator.userId,
          type: "PAYOUT_UPDATE",
          title: `You received a tip`,
          body: message || undefined,
          link: "/dashboard/earnings",
        });
    }
    return tipRow;
  });
}
