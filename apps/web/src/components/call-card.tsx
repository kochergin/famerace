"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Call } from "@famerace/db";
import { Countdown } from "@/components/countdown";
import { Monogram } from "@/components/monogram";
import { StakeButton } from "@/components/submit-button";
import { num } from "@/lib/format";

/* A call: the screenshot object. Question, the internet's number, deadline,
   and one-tap YES/NO staking. Points only — skill, not a wager. The stake row
   is a toy: preset chips and a live "if you're right" payout for both sides
   (parimutuel: winners split the whole pool pro-rata). */

export type CallWithCreator = Call & {
  creator: { handle: string; displayName: string; avatarUrl: string | null };
};

export function OddsBar({ yesPoints, noPoints }: { yesPoints: number; noPoints: number }) {
  const total = yesPoints + noPoints;
  const yes = total > 0 ? Math.round((yesPoints / total) * 100) : null;
  return (
    <div>
      <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
        <span className="text-lime">{yes === null ? "— " : `${yes}%`} yes</span>
        <span className="text-pink">{yes === null ? " —" : `${100 - yes}%`} no</span>
      </div>
      <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-edge">
        <span className="bg-lime transition-all" style={{ width: `${yes ?? 50}%` }} />
        <span className="bg-pink transition-all" style={{ width: `${100 - (yes ?? 50)}%` }} />
      </div>
    </div>
  );
}

function StakeRow({
  call,
  stakeAction,
  myPoints,
}: {
  call: CallWithCreator;
  stakeAction: (formData: FormData) => Promise<void>;
  myPoints?: number;
}) {
  const [points, setPoints] = useState(10);
  const presets = useMemo(() => {
    const base = [10, 25, 50];
    return typeof myPoints === "number" && myPoints > 0
      ? [...base.filter((p) => p < myPoints), myPoints]
      : base;
  }, [myPoints]);

  /* Parimutuel payout if your side wins: stake · (pool + stake) / (side + stake). */
  const winnings = (side: number) => {
    const pool = call.yesPoints + call.noPoints;
    if (points <= 0) return 0;
    return Math.floor((points * (pool + points)) / (side + points));
  };
  const yesWin = winnings(call.yesPoints);
  const noWin = winnings(call.noPoints);

  return (
    <form action={stakeAction} className="mt-3">
      <input type="hidden" name="callId" value={call.id} />
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPoints(p)}
            className={`stat rounded border px-2.5 py-1 text-xs font-bold transition ${
              points === p ? "border-lime text-lime" : "border-edge text-muted hover:border-chrome hover:text-chalk"
            }`}
          >
            {p === myPoints ? "ALL IN" : p}
          </button>
        ))}
        <input
          name="points"
          type="number"
          min={1}
          step={1}
          required
          value={points}
          onChange={(e) => setPoints(Math.max(0, Math.round(Number(e.target.value))))}
          className="w-20 rounded border border-edge bg-ink px-2.5 py-1.5 text-sm text-chalk focus:border-lime focus:outline-none"
          title="Taste Points to stake"
        />
        <StakeButton side="YES" />
        <StakeButton side="NO" />
      </div>
      <p key={points} className="feed-in stat mt-1.5 text-[11px] text-muted">
        right as <span className="font-bold text-lime">YES</span> → {num(yesWin)} pts · right as{" "}
        <span className="font-bold text-pink">NO</span> → {num(noWin)} pts
        {typeof myPoints === "number" ? <span> · {num(myPoints)} available</span> : null}
      </p>
    </form>
  );
}

export function CallCard({
  call,
  stakeAction,
  myStake,
  signedIn,
  myPoints,
  showCreator = true,
}: {
  call: CallWithCreator;
  stakeAction: (formData: FormData) => Promise<void>;
  myStake?: { side: string; points: number } | null;
  signedIn: boolean;
  myPoints?: number;
  showCreator?: boolean;
}) {
  return (
    <div className="card p-5" style={{ "--glow": "rgb(201 247 58 / 0.2)" } as React.CSSProperties}>
      {showCreator ? (
        <Link href={`/c/${call.creator.handle}`} className="mb-3 flex items-center gap-2 transition hover:opacity-80">
          <Monogram name={call.creator.displayName} src={call.creator.avatarUrl} size="sm" />
          <span className="font-semibold text-chalk">{call.creator.displayName}</span>
        </Link>
      ) : null}
      <h3 className="display text-2xl leading-snug">{call.question}</h3>
      <p className="stat mt-1 text-xs text-muted">
        {num(call.yesPoints + call.noPoints)} points staked · resolves in{" "}
        <Countdown to={new Date(call.deadline).toISOString()} className="text-chalk" /> · settled automatically
        from live platform numbers
      </p>
      <div className="mt-3">
        <OddsBar yesPoints={call.yesPoints} noPoints={call.noPoints} />
      </div>
      {myStake ? (
        <p className="chip mt-3 border border-lime/40 bg-lime/10 text-lime">
          Your position: {myStake.side} · {num(myStake.points)} pts
        </p>
      ) : signedIn ? (
        <StakeRow call={call} stakeAction={stakeAction} myPoints={myPoints} />
      ) : (
        <Link href="/join" className="mt-3 inline-block text-xs font-bold uppercase tracking-wide text-volt underline">
          Join to make the call
        </Link>
      )}
    </div>
  );
}
