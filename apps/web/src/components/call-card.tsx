import Link from "next/link";
import type { Call } from "@famerace/db";
import { Countdown } from "@/components/countdown";
import { Monogram } from "@/components/monogram";
import { StakeButton } from "@/components/submit-button";
import { num } from "@/lib/format";

/* A call: the screenshot object. Question, the internet's number, deadline,
   and one-tap YES/NO staking. Points only — skill, not a wager. */

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
        <Countdown to={call.deadline.toISOString()} className="text-chalk" /> · settled automatically
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
        <form action={stakeAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="callId" value={call.id} />
          <input
            name="points"
            type="number"
            min={1}
            step={1}
            defaultValue={10}
            required
            className="w-20 rounded border border-edge bg-ink px-2.5 py-1.5 text-sm text-chalk focus:border-lime focus:outline-none"
            title="Taste Points to stake"
          />
          <StakeButton side="YES" />
          <StakeButton side="NO" />
          {typeof myPoints === "number" ? (
            <span className="stat text-xs text-muted">{num(myPoints)} pts available</span>
          ) : null}
        </form>
      ) : (
        <Link href="/join" className="mt-3 inline-block text-xs font-bold uppercase tracking-wide text-volt underline">
          Join to make the call
        </Link>
      )}
    </div>
  );
}
