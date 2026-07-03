import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { Monogram } from "@/components/monogram";

/* The fandom war scoreboard: two crowds, one deadline, live tug-of-war.
   Backing during the window is the only way to move the number — so the
   creator's repost isn't "support me", it's "help me win". */

export type BattleView = {
  id: string;
  endsAt: Date;
  a: { creator: { handle: string; displayName: string; avatarUrl: string | null } | null; gained: number };
  b: { creator: { handle: string; displayName: string; avatarUrl: string | null } | null; gained: number };
};

export function BattleStrip({ battle, focusHandle }: { battle: BattleView; focusHandle?: string }) {
  if (!battle.a.creator || !battle.b.creator) return null;
  const total = battle.a.gained + battle.b.gained;
  const aShare = total > 0 ? battle.a.gained / total : 0.5;
  const leader =
    battle.a.gained === battle.b.gained ? null : battle.a.gained > battle.b.gained ? battle.a : battle.b;

  const side = (entry: BattleView["a"], align: "left" | "right") => (
    <Link
      href={`/c/${entry.creator!.handle}`}
      className={`flex min-w-0 items-center gap-2.5 transition hover:opacity-85 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <Monogram name={entry.creator!.displayName} src={entry.creator!.avatarUrl} size="md" ring={leader?.creator?.handle === entry.creator!.handle ? "live" : "none"} />
      <span className="min-w-0">
        <span className="display block truncate text-xl leading-none">{entry.creator!.displayName}</span>
        <span className={`stat text-xs font-bold ${align === "left" ? "text-lime" : "text-pink"}`}>
          +{entry.gained} new backer{entry.gained === 1 ? "" : "s"}
        </span>
      </span>
    </Link>
  );

  return (
    <section
      className="card spotlight p-5"
      style={{ "--spot": "rgb(255 61 141 / 0.12)" } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="stat text-[10px] uppercase tracking-[0.3em] text-pink">⚔ Battle · whose crowd grows faster</p>
        <p className="stat text-xs text-muted">
          ends in <Countdown to={new Date(battle.endsAt).toISOString()} className="font-bold text-chalk" />
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        {side(battle.a, "left")}
        <span className="display shrink-0 text-2xl text-muted">VS</span>
        {side(battle.b, "right")}
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-edge" aria-hidden>
        <span className="bg-lime transition-all" style={{ width: `${Math.round(aShare * 100)}%` }} />
        <span className="bg-pink transition-all" style={{ width: `${100 - Math.round(aShare * 100)}%` }} />
      </div>
      {focusHandle ? (
        <p className="mt-2.5 text-xs text-muted">
          Every new backer during the battle counts.{" "}
          <span className="font-bold text-chalk">Back {focusHandle === battle.a.creator.handle ? battle.a.creator.displayName : battle.b.creator.displayName} below to move the bar.</span>
        </p>
      ) : null}
    </section>
  );
}
