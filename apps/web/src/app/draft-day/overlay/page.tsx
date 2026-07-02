import { draftday } from "@famerace/core";
import { DraftDayShow, type ShowRow } from "@/components/draft-day-show";
import { CATEGORY_LABELS, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Draft Day overlay — FameRace", robots: { index: false } };

/** Chromeless broadcast view for creator co-streams (OBS browser source).
 *  Same synced clock as /draft-day — the co-stream and the site stay in step. */
export default async function DraftDayOverlayPage() {
  const info = await draftday.draftDayInfo();
  if (!info.draftDayAt) {
    return <div className="fixed inset-0 z-50 bg-ink" />;
  }
  const lineup = await draftday.draftDayLineup();
  const rows: ShowRow[] = lineup.map((row) => ({
    rank: row.rank,
    draftId: row.draftId,
    name: row.name,
    category: row.category,
    categoryLabel: CATEGORY_LABELS[row.category] ?? row.category,
    fanCount: row.fanCount,
    pledgedLabel: money(row.pledgedDemandTotal, { compact: true }),
    claimed: row.claimStatus === "CLAIMED",
    creator: row.creator
      ? {
          handle: row.creator.handle,
          avatarUrl: row.creator.avatarUrl,
          ticker: row.creator.ticker,
          priceLabel: row.creator.priceCents !== null ? money(row.creator.priceCents) : null,
        }
      : null,
  }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink px-6 pt-2">
      <DraftDayShow
        lineup={rows}
        startIso={info.draftDayAt.toISOString()}
        intervalMs={draftday.REVEAL_INTERVAL_MS}
        serverNowIso={new Date().toISOString()}
      />
    </div>
  );
}
