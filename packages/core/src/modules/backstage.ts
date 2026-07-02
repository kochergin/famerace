import { prisma, type BackstagePost } from "@famerace/db";
import { z } from "zod";
import { config } from "../config";
import { DomainError, notFound } from "../errors";
import { paymentProvider } from "../payments";
import { audit } from "../statemachine";
import { notify } from "./notify";
import { postLedgerTx } from "./ledger";
import { enforceProhibited } from "./safety";

// Backstage (PRD §9.7): direct-to-fan recurring revenue. Tiers can be paid,
// holder-gated (units requirement) or free. Posts lock behind membership.

export const tierSchema = z.object({
  name: z.string().min(2).max(40),
  priceCents: z.number().int().min(100).max(100_000),
  accessType: z.enum(["PAID", "HOLDER_GATED", "FREE"]).default("PAID"),
  minHoldingUnits: z.number().int().min(0).default(0),
  benefits: z.array(z.string().min(2).max(120)).max(6).default([]),
});

export async function configureTier(userId: string, input: z.input<typeof tierSchema>) {
  const data = tierSchema.parse(input);
  const creator = await prisma.creator.findFirst({ where: { userId } });
  if (!creator) throw notFound("Creator profile");
  return prisma.backstageTier.create({
    data: {
      creatorId: creator.id,
      name: data.name,
      priceCents: data.accessType === "PAID" ? data.priceCents : 0,
      accessType: data.accessType,
      minHoldingUnits: data.accessType === "HOLDER_GATED" ? data.minHoldingUnits : 0,
      benefits: data.benefits,
    },
  });
}

export async function subscribe(userId: string, tierId: string) {
  const tier = await prisma.backstageTier.findUnique({ where: { id: tierId }, include: { creator: true } });
  if (!tier) throw notFound("Backstage tier");
  if (tier.creator.status !== "LIVE") throw new DomainError("NOT_LIVE", "Backstage opens when the creator is live");

  if (tier.accessType === "HOLDER_GATED") {
    const market = await prisma.creatorMarket.findUnique({ where: { creatorId: tier.creatorId } });
    const holding = market
      ? await prisma.holding.findUnique({
          where: { userId_creatorMarketId: { userId, creatorMarketId: market.id } },
        })
      : null;
    if ((holding?.amountUnits ?? 0) < tier.minHoldingUnits) {
      throw new DomainError(
        "HOLDING_REQUIRED",
        `This tier unlocks by holding ${tier.minHoldingUnits}+ units`,
      );
    }
  }

  if (tier.accessType === "PAID" && tier.priceCents > 0) {
    const auth = await paymentProvider.authorize({ userId, amountCents: tier.priceCents, purpose: "backstage" });
    await paymentProvider.capture(auth.authRef);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.backstageMembership.findUnique({
      where: { userId_creatorId: { userId, creatorId: tier.creatorId } },
    });
    if (existing && existing.status === "ACTIVE") {
      throw new DomainError("ALREADY_MEMBER", "You are already in this Backstage");
    }
    if (tier.accessType === "PAID" && tier.priceCents > 0) {
      const creatorCents = Math.floor((tier.priceCents * config.backstage.creatorBps) / 10_000);
      await postLedgerTx(
        tx,
        "SUBSCRIPTION",
        [
          { account: "EXTERNAL", deltaCents: -tier.priceCents, userId },
          { account: "CREATOR_EARNED", deltaCents: creatorCents, creatorId: tier.creatorId },
          { account: "PLATFORM_FEES", deltaCents: tier.priceCents - creatorCents },
        ],
        { kind: "backstage_subscription", tierId },
      );
    }
    const renewsAt = new Date(Date.now() + 30 * 86_400_000);
    const membership = existing
      ? await tx.backstageMembership.update({
          where: { id: existing.id },
          data: { tierId, status: "ACTIVE", renewsAt, priceCents: tier.priceCents, canceledAt: null },
        })
      : await tx.backstageMembership.create({
          data: {
            userId,
            creatorId: tier.creatorId,
            tierId,
            priceCents: tier.priceCents,
            renewsAt,
          },
        });
    await audit(tx, {
      actorId: userId,
      action: "BACKSTAGE_SUBSCRIBED",
      objectType: "BackstageMembership",
      objectId: membership.id,
    });
    return membership;
  });
}

export async function cancelMembership(userId: string, creatorId: string) {
  const membership = await prisma.backstageMembership.findUnique({
    where: { userId_creatorId: { userId, creatorId } },
  });
  if (!membership) throw notFound("Membership");
  // Access runs to the end of the paid period; no partial refunds (PRD §9.7).
  return prisma.backstageMembership.update({
    where: { id: membership.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
}

export const postSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(1).max(5000),
  preview: z.string().max(240).optional().or(z.literal("")),
  mediaUrl: z.string().max(300).regex(/^(https?:\/\/|\/img\/)/).optional().or(z.literal("")),
  visibility: z.enum(["PUBLIC_PREVIEW", "MEMBERS", "HOLDERS"]).default("MEMBERS"),
});

export async function createPost(userId: string, input: z.input<typeof postSchema>) {
  const data = postSchema.parse(input);
  enforceProhibited("post", data.title, data.body, data.preview);
  return prisma.$transaction(async (tx) => {
    const creator = await tx.creator.findFirst({ where: { userId } });
    if (!creator) throw notFound("Creator profile");
    const post = await tx.backstagePost.create({
      data: {
        creatorId: creator.id,
        title: data.title,
        body: data.body,
        preview: data.preview || null,
        mediaUrl: data.mediaUrl || null,
        visibility: data.visibility,
      },
    });
    const members = await tx.backstageMembership.findMany({
      where: { creatorId: creator.id, status: "ACTIVE" },
      select: { userId: true },
    });
    for (const member of members) {
      await notify(tx, {
          userId: member.userId,
          type: "BACKSTAGE_POST",
          title: `New Backstage post from ${creator.displayName}`,
          body: data.title,
          link: `/c/${creator.handle}`,
        });
    }
    return post;
  });
}

/** Membership lapse sweep: past renewsAt → EXPIRED (canceled) / PAST_DUE. */
export async function sweepMemberships(now = new Date()): Promise<number> {
  const canceled = await prisma.backstageMembership.updateMany({
    where: { status: "CANCELED", renewsAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  const lapsed = await prisma.backstageMembership.updateMany({
    where: { status: "ACTIVE", renewsAt: { lte: now } },
    data: { status: "PAST_DUE" },
  });
  return canceled.count + lapsed.count;
}

export type PostAccess = { post: BackstagePost; unlocked: boolean };

/** Backstage feed with per-post lock state for the viewer (PRD §7.3). */
export async function feedFor(creatorId: string, viewerUserId: string | null): Promise<PostAccess[]> {
  const posts = await prisma.backstagePost.findMany({
    where: { creatorId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  if (posts.length === 0) return [];

  const creator = await prisma.creator.findUnique({ where: { id: creatorId }, select: { userId: true } });
  if (viewerUserId && creator?.userId === viewerUserId) {
    return posts.map((post) => ({ post, unlocked: true }));
  }

  const membership = viewerUserId
    ? await prisma.backstageMembership.findUnique({
        where: { userId_creatorId: { userId: viewerUserId, creatorId } },
      })
    : null;
  const isMember =
    membership != null &&
    (membership.status === "ACTIVE" || (membership.status === "CANCELED" && membership.renewsAt > new Date()));

  let holdsUnits = false;
  if (viewerUserId) {
    const market = await prisma.creatorMarket.findUnique({ where: { creatorId } });
    if (market) {
      const holding = await prisma.holding.findUnique({
        where: { userId_creatorMarketId: { userId: viewerUserId, creatorMarketId: market.id } },
      });
      holdsUnits = (holding?.amountUnits ?? 0) > 0;
    }
  }

  return posts.map((post) => ({
    post,
    unlocked:
      post.visibility === "PUBLIC_PREVIEW" ||
      (post.visibility === "MEMBERS" && (isMember || holdsUnits)) ||
      (post.visibility === "HOLDERS" && holdsUnits),
  }));
}
