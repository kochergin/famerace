import { prisma, type CreatorCategory, type DraftProfile, type Prisma } from "@famerace/db";
import { z } from "zod";
import { DomainError, notFound } from "../errors";
import { emitEvent } from "../events";
import { audit } from "../statemachine";
import { enforceProhibited } from "./safety";

// Draft layer (PRD §9A.1–§9A.2, §9.3): anyone can draft, only claimed
// creators go live. DraftProfile has no market relations by design.

export const nominateSchema = z.object({
  nameOrHandle: z.string().min(2).max(60),
  externalLink: z
    .string()
    .url()
    .max(300)
    .refine((u) => /^https?:\/\//i.test(u), "Link must start with http(s)://")
    .optional()
    .or(z.literal("")),
  category: z.enum(["MUSICIAN", "INTERNET_CREATOR", "BUILDER_FOUNDER", "ARTIST_DESIGNER"]),
  thesis: z.string().min(20, "Tell us why they are rising (20+ characters)").max(2000),
  requestedMission: z.string().max(200).optional().or(z.literal("")),
});

/** "@Mira Music" / "https://tiktok.com/@mira" → "mira" style normalization. */
export function normalizeHandle(raw: string): string {
  let s = raw.trim().toLowerCase();
  try {
    if (s.startsWith("http")) {
      const url = new URL(s);
      s = url.pathname.replaceAll("/", " ").trim() || url.hostname;
    }
  } catch {
    // keep raw string if URL parsing fails
  }
  return s.replace(/^@/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

/**
 * Scout nomination (PRD §9.3). Duplicate detection: same normalized handle +
 * category attaches the nomination to the existing profile instead of
 * creating a second one — "17 scouts inviting" is a feature, not a dupe.
 */
export async function nominate(scoutUserId: string, input: z.input<typeof nominateSchema>) {
  const data = nominateSchema.parse(input);
  const normalizedHandle = normalizeHandle(data.nameOrHandle);
  if (!normalizedHandle) throw new DomainError("BAD_HANDLE", "Could not read a handle from that input");
  // Prohibited categories never enter the draft (§15.4); soft hits get
  // FLAGGED moderation priority below.
  const flagged = enforceProhibited("nomination", data.nameOrHandle, data.thesis, data.requestedMission);

  return prisma.$transaction(async (tx) => {
    let profile = await tx.draftProfile.findUnique({
      where: { normalizedHandle_category: { normalizedHandle, category: data.category } },
    });
    const isNew = !profile;

    profile ??= await tx.draftProfile.create({
      data: {
        nameOrHandle: data.nameOrHandle.trim(),
        normalizedHandle,
        externalLink: data.externalLink || null,
        category: data.category,
        reasonNominated: data.thesis.slice(0, 280),
        nominatedByUserId: scoutUserId,
        requestedMission: data.requestedMission || null,
      },
    });

    const nomination = await tx.scoutNomination.create({
      data: {
        scoutUserId,
        draftProfileId: profile.id,
        creatorHandle: data.nameOrHandle.trim(),
        category: data.category,
        thesis: data.thesis,
        requestedMission: data.requestedMission || null,
        status: isNew ? "PENDING" : "APPROVED",
      },
    });

    if (isNew) {
      // New profiles enter the moderation queue (PRD §9A.1) before they
      // appear on the public board.
      await tx.moderationItem.create({
        data: {
          objectType: "DraftProfile",
          objectId: profile.id,
          queue: "DRAFT_MOD",
          notes: flagged ? "Auto-flagged: touches a sensitive-category term (§15.4)" : undefined,
        },
      });
      if (flagged) {
        await tx.draftProfile.update({
          where: { id: profile.id },
          data: { moderationStatus: "FLAGGED" },
        });
      }
    }

    const scout = await tx.user.findUniqueOrThrow({
      where: { id: scoutUserId },
      select: { roles: true },
    });
    if (!scout.roles.includes("SCOUT")) {
      await tx.user.update({
        where: { id: scoutUserId },
        data: { roles: [...scout.roles, "SCOUT"] },
      });
    }

    await audit(tx, {
      actorId: scoutUserId,
      action: isNew ? "DRAFT_PROFILE_CREATED" : "NOMINATION_ADDED",
      objectType: "DraftProfile",
      objectId: profile.id,
    });
    await emitEvent(tx, {
      type: "NOMINATION_CREATED",
      actorId: scoutUserId,
      draftProfileId: profile.id,
      message: `${profile.nameOrHandle} was nominated to the Draft`,
      visibility: isNew ? "PRIVATE" : "PUBLIC", // public once the profile is approved
    });
    return { profile, nomination, isNew };
  });
}

export type DraftBoardFilters = {
  category?: CreatorCategory;
  status?: "UNCLAIMED" | "CLAIM_STARTED" | "CLAIMED";
};

export type DraftBoardRow = DraftProfile & {
  rank: number;
  scoutCount: number;
};

/** Draft Board ranked by fan demand (PRD §9A.1). */
export async function draftBoard(filters: DraftBoardFilters = {}): Promise<DraftBoardRow[]> {
  const where: Prisma.DraftProfileWhereInput = {
    moderationStatus: "APPROVED",
    takedownStatus: { in: ["NONE", "REQUESTED"] },
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { claimStatus: filters.status } : {}),
  };
  const profiles = await prisma.draftProfile.findMany({
    where,
    orderBy: [{ pledgedDemandTotal: "desc" }, { fanCount: "desc" }, { createdAt: "asc" }],
    take: 200,
  });
  const scoutCounts = await prisma.scoutNomination.groupBy({
    by: ["draftProfileId"],
    where: { draftProfileId: { in: profiles.map((p) => p.id) } },
    _count: true,
  });
  const countMap = new Map(scoutCounts.map((c) => [c.draftProfileId, c._count]));
  return profiles.map((p, i) => ({ ...p, rank: i + 1, scoutCount: countMap.get(p.id) ?? 0 }));
}

export async function getDraftProfile(id: string) {
  const profile = await prisma.draftProfile.findUnique({
    where: { id },
    include: {
      nominations: {
        where: { status: { not: "REJECTED" } },
        include: { scout: { select: { username: true, displayName: true } } },
        orderBy: { createdAt: "asc" },
      },
      claimBounty: true,
      claimedCreator: { select: { id: true, handle: true, status: true } },
    },
  });
  if (!profile) throw notFound("Draft profile");
  return profile;
}

/** Fan watches a draft (adds to roster, PRD §9A.2 "add-to-roster button"). */
export async function watchDraft(userId: string, draftProfileId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.rosterEntry.findUnique({
      where: { userId_draftProfileId: { userId, draftProfileId } },
    });
    if (existing) return;
    await tx.rosterEntry.create({
      data: { userId, draftProfileId, source: "WATCHING" },
    });
    await tx.draftProfile.update({
      where: { id: draftProfileId },
      data: { fanCount: { increment: 1 } },
    });
  });
}

/** Invite pressure (PRD §0A.10): count invites, return attributed link. */
export async function recordInvite(userId: string, draftProfileId: string): Promise<string> {
  const [profile, user] = await Promise.all([
    prisma.draftProfile.update({
      where: { id: draftProfileId },
      data: { inviteCount: { increment: 1 } },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } }),
  ]);
  return `/claim/${profile.id}?scout=${user.referralCode}`;
}

export const takedownSchema = z.object({
  requesterContact: z.string().min(5).max(200),
  reason: z.string().min(10).max(2000),
});

/** Takedown request from the profile subject (PRD §15.1, §9A.2). */
export async function requestTakedown(draftProfileId: string, input: z.infer<typeof takedownSchema>) {
  const data = takedownSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const profile = await tx.draftProfile.findUnique({ where: { id: draftProfileId } });
    if (!profile) throw notFound("Draft profile");
    const request = await tx.takedownRequest.create({
      data: { draftProfileId, requesterContact: data.requesterContact, reason: data.reason },
    });
    if (profile.takedownStatus === "NONE") {
      await tx.draftProfile.update({
        where: { id: draftProfileId },
        data: { takedownStatus: "REQUESTED" },
      });
    }
    await audit(tx, {
      actorType: "SYSTEM",
      action: "TAKEDOWN_REQUESTED",
      objectType: "DraftProfile",
      objectId: draftProfileId,
    });
    return request;
  });
}

// ── Moderation actions (used by the admin surface) ──

export async function moderateDraft(
  adminId: string,
  draftProfileId: string,
  decision: "APPROVED" | "REJECTED",
  notes?: string,
) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.draftProfile.findUnique({ where: { id: draftProfileId } });
    if (!profile) throw notFound("Draft profile");
    await tx.draftProfile.update({
      where: { id: draftProfileId },
      data: { moderationStatus: decision },
    });
    await tx.moderationItem.updateMany({
      where: { objectType: "DraftProfile", objectId: draftProfileId, queue: "DRAFT_MOD" },
      data: { status: decision, assigneeUserId: adminId, notes },
    });
    await tx.scoutNomination.updateMany({
      where: { draftProfileId, status: "PENDING" },
      data: { status: decision },
    });
    await audit(tx, {
      actorId: adminId,
      actorType: "ADMIN",
      action: `DRAFT_${decision}`,
      objectType: "DraftProfile",
      objectId: draftProfileId,
      before: { moderationStatus: profile.moderationStatus },
      after: { moderationStatus: decision },
    });
    if (decision === "APPROVED") {
      // Claim Bounty (PRD §9A.6 / §0A.10): unlocked for the first valid scout
      // when the creator claims. Base $50, +5% of pledged demand, capped $2,500.
      const bountyCents = Math.min(
        250_000,
        5_000 + Math.floor(profile.pledgedDemandTotal * 0.05),
      );
      await tx.claimBounty.upsert({
        where: { draftProfileId },
        create: { draftProfileId, amountCents: bountyCents, points: 100 },
        update: {},
      });
      await emitEvent(tx, {
        type: "NOMINATION_CREATED",
        draftProfileId,
        message: `${profile.nameOrHandle} entered the Draft Board`,
      });
    }
  });
}

/**
 * Draft Rank snapshot (PRD §0A.9 "live Draft Rank changes"): diff the current
 * board order against the stored ranks and emit riser events. Sweep-driven.
 */
export async function snapshotDraftRanks(): Promise<number> {
  const board = await draftBoard();
  let changes = 0;
  for (const row of board) {
    if (row.lastRank !== null && row.rank < row.lastRank) {
      await emitEvent(prisma, {
        type: "DRAFT_RANK_CHANGED",
        draftProfileId: row.id,
        message: `${row.nameOrHandle} climbed to #${row.rank} on the Draft`,
      });
      changes += 1;
    }
    if (row.lastRank !== row.rank) {
      await prisma.draftProfile.update({ where: { id: row.id }, data: { lastRank: row.rank } });
    }
  }
  return changes;
}
