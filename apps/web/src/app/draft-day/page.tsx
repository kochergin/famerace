import Link from "next/link";
import { draftday } from "@famerace/core";
import { DraftDayLive } from "@/components/draft-day-live";
import { DraftDayShow, type ShowRow } from "@/components/draft-day-show";
import { Crowd, StageLights } from "@/components/stage";
import { EmptyState } from "@/components/ui";
import { CATEGORY_LABELS, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Draft Day — FameRace" };

/** Draft Day: the season's broadcast moment. Countdown → synced rank-by-rank
 *  reveal → the final Genesis board. */
export default async function DraftDayPage() {
  const info = await draftday.draftDayInfo();
  if (!info.draftDayAt) {
    return (
      <div className="mx-auto max-w-md py-12">
        <EmptyState
          title="Draft Day is not on the calendar yet"
          hint="When the season schedules its reveal, the countdown starts here."
        />
        <Link
          href="/draft"
          className="mt-4 block rounded bg-lime px-4 py-3 text-center font-bold uppercase tracking-wide text-ink hover:brightness-110"
        >
          Open the Draft Board
        </Link>
      </div>
    );
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
    <div className="relative">
      <StageLights />
      <DraftDayShow
        lineup={rows}
        startIso={info.draftDayAt.toISOString()}
        intervalMs={draftday.REVEAL_INTERVAL_MS}
        serverNowIso={new Date().toISOString()}
      />
      <div className="mx-auto max-w-3xl">
        <DraftDayLive />
        <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-muted">
          Streaming the show?{" "}
          <Link href="/draft-day/overlay" className="underline hover:text-chalk">
            OBS overlay view →
          </Link>
        </p>
      </div>
      <div className="relative mt-4 h-24">
        <Crowd />
      </div>
    </div>
  );
}
