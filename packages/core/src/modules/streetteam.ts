import { prisma } from "@famerace/db";
import { z } from "zod";
import { DomainError, notFound } from "../errors";
import { emitEvent } from "../events";
import { audit } from "../statemachine";
import { notify } from "./notify";

// Street Team quests (PRD §4.4, §9.13) and Backer Crews (§9A.7/§0A.16).
// Quests: creator posts an action → fans submit proof → approval grants
// XP/points and crew points. Crews: team identity + weekly leaderboard.

export const questSchema = z.object({
  title: z.string().min(4).max(120),
  description: z.string().min(10).max(1000),
  type: z.enum([
    "SHARE",
    "INVITE",
    "CONTENT",
    "PLAYLIST",
    "ENGAGEMENT",
    "MEME",
    "TRANSLATION",
    "FEEDBACK",
    "LAUNCH_SUPPORT",
    "BRAND_INTRO",
    "EVENT",
  ]),
  proofType: z.enum(["LINK", "SCREENSHOT", "AUTO"]).default("LINK"),
  rewardType: z.enum(["XP", "POINTS", "BADGE", "CREW_POINTS"]).default("XP"),
  rewardAmount: z.number().int().min(1).max(1000).default(25),
  deadlineDays: z.number().int().min(1).max(60).optional(),
  maxCompletions: z.number().int().min(1).max(10_000).optional(),
});

export async function createQuest(userId: string, input: z.input<typeof questSchema>) {
  const data = questSchema.parse(input);
  const creator = await prisma.creator.findFirst({ where: { userId } });
  if (!creator) throw notFound("Creator profile");
  return prisma.quest.create({
    data: {
      creatorId: creator.id,
      title: data.title,
      description: data.description,
      type: data.type,
      proofType: data.proofType,
      rewardType: data.rewardType,
      rewardAmount: data.rewardAmount,
      deadline: data.deadlineDays ? new Date(Date.now() + data.deadlineDays * 86_400_000) : null,
      maxCompletions: data.maxCompletions ?? null,
      status: "LIVE",
    },
  });
}

export async function submitCompletion(userId: string, questId: string, proofRef: string) {
  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest || quest.status !== "LIVE") throw notFound("Quest");
  if (quest.deadline && quest.deadline < new Date()) {
    throw new DomainError("QUEST_CLOSED", "This quest's deadline has passed");
  }
  if (quest.maxCompletions && quest.completionCount >= quest.maxCompletions) {
    throw new DomainError("QUEST_FULL", "This quest hit its completion cap");
  }
  if (quest.proofType !== "AUTO" && proofRef.trim().length < 4) {
    throw new DomainError("PROOF_REQUIRED", "Add a proof link or reference");
  }
  return prisma.questCompletion.create({
    data: { questId, userId, proofRef: proofRef.trim() || null },
  });
}

/** Creator (or admin) reviews a submission; approval grants the reward. */
export async function reviewCompletion(
  reviewerUserId: string,
  completionId: string,
  decision: "APPROVED" | "REJECTED",
) {
  return prisma.$transaction(async (tx) => {
    const completion = await tx.questCompletion.findUnique({
      where: { id: completionId },
      include: { quest: { include: { creator: true } }, user: true },
    });
    if (!completion) throw notFound("Submission");
    const reviewer = await tx.user.findUniqueOrThrow({ where: { id: reviewerUserId } });
    const isCreator = completion.quest.creator.userId === reviewerUserId;
    const isAdmin = reviewer.roles.includes("ADMIN") || reviewer.roles.includes("MODERATOR");
    if (!isCreator && !isAdmin) throw new DomainError("FORBIDDEN", "Only the creator or an admin can review", 403);
    if (completion.status !== "SUBMITTED") throw new DomainError("ALREADY_REVIEWED", "Already reviewed");

    await tx.questCompletion.update({ where: { id: completionId }, data: { status: decision } });
    if (decision === "APPROVED") {
      const quest = completion.quest;
      await tx.quest.update({ where: { id: quest.id }, data: { completionCount: { increment: 1 } } });
      if (quest.rewardType === "XP") {
        await tx.user.update({ where: { id: completion.userId }, data: { xp: { increment: quest.rewardAmount } } });
      } else if (quest.rewardType === "POINTS" || quest.rewardType === "CREW_POINTS") {
        await tx.user.update({ where: { id: completion.userId }, data: { points: { increment: quest.rewardAmount } } });
      } else if (quest.rewardType === "BADGE") {
        await tx.userBadge.create({
          data: {
            userId: completion.userId,
            badgeType: "STREET_TEAM",
            label: `Street Team: ${quest.title}`,
            sourceRef: quest.id,
          },
        });
      }
      // Crew points always accrue on approved quests (team retention loop).
      const membership = await tx.crewMember.findUnique({ where: { userId: completion.userId } });
      if (membership) {
        await tx.crewMember.update({
          where: { id: membership.id },
          data: { points: { increment: quest.rewardAmount } },
        });
        await tx.crew.update({
          where: { id: membership.crewId },
          data: { score: { increment: quest.rewardAmount }, questsCompleted: { increment: 1 } },
        });
      }
      await notify(tx, {
          userId: completion.userId,
          type: "QUEST_APPROVED",
          title: `Quest approved: ${quest.title}`,
          body: `+${quest.rewardAmount} ${quest.rewardType.toLowerCase().replaceAll("_", " ")}`,
          link: `/c/${quest.creator.handle}`,
        });
      await emitEvent(tx, {
        type: "QUEST_COMPLETED",
        actorId: completion.userId,
        creatorId: quest.creatorId,
        message: `Street Team quest completed for ${quest.creator.displayName}: ${quest.title}`,
      });
    }
    await audit(tx, {
      actorId: reviewerUserId,
      action: `QUEST_${decision}`,
      objectType: "QuestCompletion",
      objectId: completionId,
    });
    return decision;
  });
}

// ── Crews ──

export const crewSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[\w .'-]+$/, "Letters, numbers and simple punctuation only"),
  description: z.string().max(300).optional().or(z.literal("")),
});

export async function createCrew(userId: string, input: z.input<typeof crewSchema>) {
  const data = crewSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crewMember.findUnique({ where: { userId } });
    if (existing) throw new DomainError("ONE_CREW", "Leave your current crew first");
    const crew = await tx.crew.create({
      data: { name: data.name.trim(), description: data.description || null },
    });
    await tx.crewMember.create({ data: { crewId: crew.id, userId, role: "FOUNDER" } });
    return crew;
  });
}

export async function joinCrew(userId: string, crewId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crewMember.findUnique({ where: { userId } });
    if (existing) throw new DomainError("ONE_CREW", "Leave your current crew first");
    const crew = await tx.crew.findUnique({ where: { id: crewId } });
    if (!crew) throw notFound("Crew");
    return tx.crewMember.create({ data: { crewId, userId } });
  });
}

export async function leaveCrew(userId: string) {
  const membership = await prisma.crewMember.findUnique({ where: { userId } });
  if (!membership) throw notFound("Crew membership");
  await prisma.crewMember.delete({ where: { id: membership.id } });
}

/** Weekly-style leaderboard recompute: rank crews by score. */
export async function rankCrews(): Promise<number> {
  const crews = await prisma.crew.findMany({ orderBy: [{ score: "desc" }, { createdAt: "asc" }] });
  for (const [index, crew] of crews.entries()) {
    const rank = index + 1;
    if (crew.rank !== rank) {
      await prisma.crew.update({ where: { id: crew.id }, data: { rank } });
      if (crew.rank !== null && rank < crew.rank) {
        await emitEvent(prisma, {
          type: "CREW_RANKED_UP",
          message: `Crew ${crew.name} climbed to #${rank}`,
        });
      }
    }
  }
  return crews.length;
}

export async function crewLeaderboard(limit = 20) {
  return prisma.crew.findMany({
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: limit,
    include: { _count: { select: { members: true } } },
  });
}

export async function crewDetail(crewId: string) {
  const crew = await prisma.crew.findUnique({
    where: { id: crewId },
    include: {
      members: {
        include: { user: { select: { username: true, displayName: true } } },
        orderBy: { points: "desc" },
      },
    },
  });
  if (!crew) throw notFound("Crew");
  return crew;
}
