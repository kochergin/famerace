"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Confetti } from "@/components/confetti";
import { Countdown } from "@/components/countdown";
import { Monogram } from "@/components/monogram";

/* Draft Day broadcast player. The reveal index is a pure function of the
   shared wall clock (same math as core showState), so every viewer's card
   flips at the same moment and late joiners land mid-show correctly. */

export type ShowRow = {
  rank: number;
  draftId: string;
  name: string;
  category: string;
  categoryLabel: string;
  fanCount: number;
  pledgedLabel: string;
  claimed: boolean;
  creator: { handle: string; avatarUrl: string | null; ticker: string | null; priceLabel: string | null } | null;
};

function revealedCount(startMs: number, nowMs: number, size: number, intervalMs: number): number {
  const elapsed = nowMs - startMs;
  if (elapsed < 0) return 0;
  return Math.min(size, Math.floor(elapsed / intervalMs) + 1);
}

export function DraftDayShow({
  lineup,
  startIso,
  intervalMs,
  serverNowIso,
}: {
  lineup: ShowRow[]; // rank ascending (#1 first)
  startIso: string;
  intervalMs: number;
  serverNowIso: string;
}) {
  const startMs = useMemo(() => new Date(startIso).getTime(), [startIso]);
  const [nowMs, setNowMs] = useState(() => new Date(serverNowIso).getTime());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const size = lineup.length;
  const revealed = revealedCount(startMs, nowMs, size, intervalMs);
  const live = nowMs >= startMs;
  const done = revealed >= size;
  // Reveal runs from the bottom of the board up to #1.
  const revealedRows = lineup.slice(size - revealed); // rank ascending
  const spotlight = revealedRows[0] ?? null; // most recent flip = lowest rank so far
  const nextRank = size - revealed; // 0 when done
  const msToNext = live && !done ? intervalMs - ((nowMs - startMs) % intervalMs) : 0;

  if (!live) {
    return (
      <div className="relative mx-auto max-w-2xl pb-10 pt-6 text-center">
        <p className="chip mx-auto border border-pink/50 bg-pink/10 text-pink">The Genesis Reveal</p>
        <h1 className="display mt-4 text-6xl sm:text-8xl">
          DRAFT
          <br />
          <span className="display-hot">DAY.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          {size} names. One broadcast. The lineup reveals rank by rank — live for everyone at the
          same moment.
        </p>
        <Countdown to={startIso} className="display mt-8 block text-6xl text-lime sm:text-7xl" />
        <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted">Until the first card flips</p>
        <div className="mt-10 grid grid-cols-4 gap-2 sm:gap-3">
          {lineup.slice(0, 8).map((row) => (
            <MysteryCard key={row.draftId} rank={row.rank} />
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          Last hours to move early —{" "}
          <Link href="/draft" className="text-volt underline">
            pledge on the Draft Board
          </Link>{" "}
          before the show starts.
        </p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-3xl pb-10">
      <div className="flex items-center justify-between">
        <h1 className="display text-4xl sm:text-5xl">
          DRAFT DAY <span className="text-pink">— THE REVEAL</span>
        </h1>
        <span className="chip border border-pink/60 bg-pink/10 text-pink">
          <span className="pulse-soft mr-1 inline-block h-2 w-2 rounded-full bg-pink" />
          {done ? "Complete" : "On air"}
        </span>
      </div>

      {done && spotlight ? <Confetti fireKey="draft-day-no1" /> : null}

      {/* Spotlight: the latest flip (or the crowned #1 when complete) */}
      {spotlight ? (
        <div
          key={spotlight.rank}
          className="card spotlight story-in relative isolate mt-6 overflow-hidden p-8 text-center"
          style={{ "--spot": spotlight.rank === 1 ? "rgb(240 195 60 / 0.2)" : "rgb(201 247 58 / 0.14)" } as React.CSSProperties}
        >
          <span aria-hidden className="display pointer-events-none absolute -right-4 -top-10 select-none text-[180px] leading-none text-chalk/[0.05]">
            {spotlight.rank}
          </span>
          <p className="stat text-xs uppercase tracking-[0.3em] text-muted">
            {spotlight.rank === 1 ? "Your number one pick" : `Pick #${spotlight.rank}`}
          </p>
          <div className="mt-4 flex justify-center">
            <Monogram
              name={spotlight.name}
              src={spotlight.creator?.avatarUrl}
              size="xl"
              ring={spotlight.rank === 1 ? "gold" : spotlight.claimed ? "live" : "draft"}
            />
          </div>
          <h2 className={`display mt-4 text-6xl sm:text-7xl ${spotlight.rank === 1 ? "text-gold" : ""}`}>
            {spotlight.name}
          </h2>
          <p className="stat mt-3 text-sm text-muted">
            {spotlight.categoryLabel} · {spotlight.fanCount} fans waiting · {spotlight.pledgedLabel} pledged
            {spotlight.creator?.priceLabel ? ` · $${spotlight.creator.ticker} at ${spotlight.creator.priceLabel}` : ""}
          </p>
          <Link
            href={spotlight.creator ? `/c/${spotlight.creator.handle}` : `/draft/${spotlight.draftId}`}
            className="mt-5 inline-block rounded bg-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110"
          >
            {spotlight.claimed ? "Open their stage" : "Back them first"}
          </Link>
        </div>
      ) : null}

      {/* Next up */}
      {!done ? (
        <div className="card mt-4 flex items-center justify-between p-4">
          <span className="flex items-center gap-3">
            <MysteryCard rank={nextRank} compact />
            <span>
              <span className="display block text-xl">Next reveal</span>
              <span className="text-xs text-muted">Pick #{nextRank} flips in</span>
            </span>
          </span>
          <span className="stat display text-4xl text-lime" suppressHydrationWarning>
            {Math.max(0, Math.ceil(msToNext / 1000))}s
          </span>
        </div>
      ) : null}

      {/* The board so far */}
      {revealedRows.length > 1 || done ? (
        <section className="mt-8">
          <h3 className="display mb-3 text-2xl text-chalk">The board so far</h3>
          <ol className="card divide-y divide-edge">
            {revealedRows.map((row) => (
              <li key={row.draftId} className="feed-in flex items-center gap-3 px-5 py-3">
                <span className={`stat w-8 shrink-0 text-right ${row.rank === 1 ? "text-gold" : "text-muted"}`}>
                  #{row.rank}
                </span>
                <Monogram name={row.name} src={row.creator?.avatarUrl} size="sm" />
                <Link
                  href={row.creator ? `/c/${row.creator.handle}` : `/draft/${row.draftId}`}
                  className="min-w-0 flex-1 truncate font-semibold text-chalk hover:text-lime"
                >
                  {row.name}
                </Link>
                <span className="stat hidden text-xs text-muted sm:inline">{row.categoryLabel}</span>
                <span className="stat text-sm font-bold text-lime">{row.pledgedLabel}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function MysteryCard({ rank, compact = false }: { rank: number; compact?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex select-none items-center justify-center overflow-hidden rounded-lg border border-edge bg-panel ${
        compact ? "h-12 w-12" : "aspect-[3/4] w-full"
      }`}
    >
      <span className="display text-2xl text-chalk/20">?</span>
      <span className="stat absolute bottom-1 right-1.5 text-[10px] text-muted">#{rank}</span>
    </span>
  );
}
