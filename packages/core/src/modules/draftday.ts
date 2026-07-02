import { prisma } from "@famerace/db";
import { draftBoard } from "./draft";

/**
 * Draft Day (PRD §0A "Genesis Draft" moment): one scheduled broadcast where
 * the Genesis lineup reveals rank-by-rank. The reveal is paced off the shared
 * wall clock — reveal index is a pure function of (now - showStart) — so every
 * viewer sees the same card flip at the same moment, and late joiners land on
 * exactly the right beat with the earlier picks already on the board.
 */

export const REVEAL_INTERVAL_MS = Number(process.env.DRAFT_DAY_REVEAL_INTERVAL_MS ?? 30_000);
/** How long after the last reveal the page still counts as "live". */
const AFTERGLOW_MS = 60 * 60_000;

export type DraftDayState = "none" | "before" | "live" | "after";

/** Pure state machine — exported for tests and the client player. */
export function showState(input: {
  draftDayAt: Date | null;
  now: Date;
  lineupSize: number;
  intervalMs?: number;
}): { state: DraftDayState; revealed: number } {
  const { draftDayAt, now, lineupSize } = input;
  const interval = input.intervalMs ?? REVEAL_INTERVAL_MS;
  if (!draftDayAt) return { state: "none", revealed: 0 };
  const elapsed = now.getTime() - draftDayAt.getTime();
  if (elapsed < 0) return { state: "before", revealed: 0 };
  const revealed = Math.min(lineupSize, Math.floor(elapsed / interval) + 1);
  if (revealed >= lineupSize && elapsed > lineupSize * interval + AFTERGLOW_MS) {
    return { state: "after", revealed: lineupSize };
  }
  return { state: "live", revealed };
}

/** The lineup that gets revealed: the draft board, claimed rows enriched
 *  with their live creator (face, handle, price). */
export async function draftDayLineup(limit = 20) {
  const board = (await draftBoard()).slice(0, limit);
  const creators = await prisma.creator.findMany({
    where: { draftProfileId: { in: board.map((row) => row.id) } },
    select: {
      draftProfileId: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      fameScore: true,
      status: true,
      market: { select: { ticker: true, priceCents: true, holderCount: true } },
    },
  });
  const byDraft = new Map(creators.map((c) => [c.draftProfileId as string, c]));
  return board.map((row) => {
    const creator = byDraft.get(row.id) ?? null;
    return {
      rank: row.rank,
      draftId: row.id,
      name: creator?.displayName ?? row.nameOrHandle,
      category: row.category,
      claimStatus: row.claimStatus,
      fanCount: row.fanCount,
      pledgedDemandTotal: row.pledgedDemandTotal,
      reasonNominated: row.reasonNominated,
      creator: creator
        ? {
            handle: creator.handle,
            avatarUrl: creator.avatarUrl,
            fameScore: creator.fameScore,
            status: creator.status,
            ticker: creator.market?.ticker ?? null,
            priceCents: creator.market?.priceCents ?? null,
            holderCount: creator.market?.holderCount ?? null,
          }
        : null,
    };
  });
}

export type DraftDayLineupRow = Awaited<ReturnType<typeof draftDayLineup>>[number];

/** Draft Day info for pages and the app-wide banner. */
export async function draftDayInfo() {
  const season = await prisma.seasonConfig.findFirst({ where: { active: true } });
  const draftDayAt = season?.draftDayAt ?? null;
  if (!draftDayAt) {
    return { seasonName: season?.name ?? null, draftDayAt: null, state: "none" as DraftDayState };
  }
  // Cheap state probe for the banner (lineup size only matters mid-show).
  const lineupSize = await prisma.draftProfile.count({
    where: { moderationStatus: "APPROVED", takedownStatus: { in: ["NONE", "REQUESTED"] } },
  });
  const { state } = showState({ draftDayAt, now: new Date(), lineupSize: Math.max(1, lineupSize) });
  return { seasonName: season?.name ?? null, draftDayAt, state };
}
