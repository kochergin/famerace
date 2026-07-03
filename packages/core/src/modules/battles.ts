import { prisma } from "@famerace/db";
import { emitEvent } from "../events";
import { notFound } from "../errors";
import { notify } from "./notify";

/**
 * Fandom wars. Two creators, one deadline, one number: NEW distinct
 * supporters gained during the window. Baselines are captured at open and
 * finals at resolve, so backing DURING the battle is the only way to move
 * the score — the oldest fan-mobilization trick in culture, with receipts.
 */

export const BATTLE_HOURS = 72;

/** Distinct people with skin in the game: unit holders + pass holders. */
export async function supporterCount(creatorId: string): Promise<number> {
  const market = await prisma.creatorMarket.findUnique({ where: { creatorId }, select: { id: true } });
  const [holders, passes] = await Promise.all([
    market
      ? prisma.holding.findMany({ where: { creatorMarketId: market.id, amountUnits: { gt: 0 } }, select: { userId: true } })
      : Promise.resolve([] as { userId: string }[]),
    prisma.genesisPass.findMany({ where: { creatorId }, select: { userId: true } }),
  ]);
  return new Set([...holders, ...passes].map((r) => r.userId)).size;
}

export async function openBattles() {
  const battles = await prisma.battle.findMany({ where: { status: "OPEN" }, orderBy: { endsAt: "asc" } });
  return hydrate(battles);
}

export async function battleForCreator(creatorId: string) {
  const battle = await prisma.battle.findFirst({
    where: { status: "OPEN", OR: [{ creatorAId: creatorId }, { creatorBId: creatorId }] },
  });
  if (!battle) return null;
  const [row] = await hydrate([battle]);
  return row ?? null;
}

async function hydrate(battles: { id: string; creatorAId: string; creatorBId: string; aBaseline: number; bBaseline: number; endsAt: Date; status: string; winnerId: string | null }[]) {
  if (battles.length === 0) return [];
  const ids = [...new Set(battles.flatMap((b) => [b.creatorAId, b.creatorBId]))];
  const creators = await prisma.creator.findMany({
    where: { id: { in: ids } },
    select: { id: true, handle: true, displayName: true, avatarUrl: true },
  });
  const byId = new Map(creators.map((c) => [c.id, c]));
  return Promise.all(
    battles.map(async (battle) => {
      const [aNow, bNow] = await Promise.all([supporterCount(battle.creatorAId), supporterCount(battle.creatorBId)]);
      return {
        id: battle.id,
        endsAt: battle.endsAt,
        status: battle.status,
        winnerId: battle.winnerId,
        a: { creator: byId.get(battle.creatorAId) ?? null, gained: Math.max(0, aNow - battle.aBaseline) },
        b: { creator: byId.get(battle.creatorBId) ?? null, gained: Math.max(0, bNow - battle.bBaseline) },
      };
    }),
  );
}

/** Keep exactly one battle running whenever ≥2 creators are live (sweep-driven, idempotent). */
export async function ensureBattle(now = new Date()): Promise<number> {
  const open = await prisma.battle.count({ where: { status: "OPEN" } });
  if (open > 0) return 0;
  const live = await prisma.creator.findMany({
    where: { status: "LIVE" },
    orderBy: { fameScore: "desc" },
    take: 2,
    select: { id: true, displayName: true },
  });
  if (live.length < 2) return 0;
  const [a, b] = [live[0]!, live[1]!];
  const [aBaseline, bBaseline] = await Promise.all([supporterCount(a.id), supporterCount(b.id)]);
  await prisma.battle.create({
    data: {
      creatorAId: a.id,
      creatorBId: b.id,
      aBaseline,
      bBaseline,
      endsAt: new Date(now.getTime() + BATTLE_HOURS * 3600_000),
    },
  });
  await emitEvent(prisma, {
    type: "CREATOR_MILESTONE",
    message: `⚔ Battle on: ${a.displayName} vs ${b.displayName} — whose crowd grows faster in ${BATTLE_HOURS}h?`,
    creatorId: a.id,
  });
  return 1;
}

/** Settle battles past their deadline; the bigger supporter gain wins. */
export async function resolveDueBattles(now = new Date()): Promise<number> {
  const due = await prisma.battle.findMany({ where: { status: "OPEN", endsAt: { lte: now } } });
  let settled = 0;
  for (const battle of due) {
    const [aFinal, bFinal] = await Promise.all([
      supporterCount(battle.creatorAId),
      supporterCount(battle.creatorBId),
    ]);
    const aGain = Math.max(0, aFinal - battle.aBaseline);
    const bGain = Math.max(0, bFinal - battle.bBaseline);
    const winnerId = aGain === bGain ? null : aGain > bGain ? battle.creatorAId : battle.creatorBId;
    await prisma.battle.update({
      where: { id: battle.id },
      data: { status: "SETTLED", aFinal, bFinal, winnerId },
    });
    const creators = await prisma.creator.findMany({
      where: { id: { in: [battle.creatorAId, battle.creatorBId] } },
      select: { id: true, displayName: true, userId: true, handle: true },
    });
    const name = (id: string) => creators.find((c) => c.id === id)?.displayName ?? "?";
    const message =
      winnerId === null
        ? `⚔ Battle drawn: ${name(battle.creatorAId)} and ${name(battle.creatorBId)} tied at +${aGain}`
        : `⚔ ${name(winnerId)} won the battle — +${Math.max(aGain, bGain)} new backers vs +${Math.min(aGain, bGain)}`;
    await emitEvent(prisma, { type: "CREATOR_MILESTONE", message, creatorId: winnerId ?? battle.creatorAId });
    for (const creator of creators) {
      if (!creator.userId) continue;
      await notify(prisma, {
        userId: creator.userId,
        type: "CREATOR_MILESTONE",
        title: winnerId === creator.id ? "⚔ You won the battle" : winnerId === null ? "⚔ Battle drawn" : "⚔ Battle settled",
        body: message,
        link: `/c/${creator.handle}`,
      });
    }
    settled += 1;
  }
  return settled;
}

/* ── Arena unlocks: collective goals with a named reward ─────────────── */

export async function setUnlock(userId: string, atSeats: number, title: string) {
  const creator = await prisma.creator.findFirst({ where: { userId }, select: { id: true } });
  if (!creator) throw notFound("Creator profile");
  const clean = title.trim().slice(0, 120);
  if (!clean || !Number.isInteger(atSeats) || atSeats < 1 || atSeats > 100_000) {
    throw notFound("A seat goal and a reward");
  }
  return prisma.arenaUnlock.create({ data: { creatorId: creator.id, atSeats, title: clean } });
}

export async function unlocksFor(creatorId: string) {
  return prisma.arenaUnlock.findMany({ where: { creatorId }, orderBy: { atSeats: "asc" } });
}

/** Flip reached goals to UNLOCKED and tell every supporter (sweep-driven). */
export async function checkUnlocks(now = new Date()): Promise<number> {
  void now;
  const pending = await prisma.arenaUnlock.findMany({ where: { unlocked: false } });
  let flipped = 0;
  for (const unlock of pending) {
    const seats = await supporterCount(unlock.creatorId);
    if (seats < unlock.atSeats) continue;
    await prisma.arenaUnlock.update({ where: { id: unlock.id }, data: { unlocked: true } });
    const creator = await prisma.creator.findUnique({
      where: { id: unlock.creatorId },
      select: { displayName: true, handle: true, userId: true },
    });
    if (!creator) continue;
    await emitEvent(prisma, {
      type: "CREATOR_MILESTONE",
      message: `🔓 ${creator.displayName}'s crowd hit ${unlock.atSeats} — "${unlock.title}" unlocks for everyone`,
      creatorId: unlock.creatorId,
    });
    if (creator.userId) {
      await notify(prisma, {
        userId: creator.userId,
        type: "CREATOR_MILESTONE",
        title: `🔓 ${unlock.atSeats} seats — time to deliver`,
        body: `Your crowd unlocked "${unlock.title}". Post it backstage.`,
        link: "/dashboard/backstage",
      });
    }
    // Every supporter hears the door open.
    const market = await prisma.creatorMarket.findUnique({ where: { creatorId: unlock.creatorId }, select: { id: true } });
    const [holders, passes] = await Promise.all([
      market
        ? prisma.holding.findMany({ where: { creatorMarketId: market.id, amountUnits: { gt: 0 } }, select: { userId: true } })
        : Promise.resolve([] as { userId: string }[]),
      prisma.genesisPass.findMany({ where: { creatorId: unlock.creatorId }, select: { userId: true } }),
    ]);
    const supporterIds = [...new Set([...holders, ...passes].map((r) => r.userId))];
    for (const userId of supporterIds) {
      await notify(prisma, {
        userId,
        type: "CREATOR_MILESTONE",
        title: `🔓 Unlocked: ${unlock.title}`,
        body: `${creator.displayName}'s crowd hit ${unlock.atSeats} seats — you were part of it.`,
        link: `/c/${creator.handle}`,
      });
    }
    flipped += 1;
  }
  return flipped;
}
