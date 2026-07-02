import Link from "next/link";
import type { DraftBoardRow } from "@famerace/core";
import { CATEGORY_LABELS, money, num } from "@/lib/format";
import { Monogram } from "./monogram";

const CATEGORY_EDGE: Record<string, string> = {
  MUSICIAN: "border-l-pink/70",
  INTERNET_CREATOR: "border-l-volt/70",
  BUILDER_FOUNDER: "border-l-lime/70",
  ARTIST_DESIGNER: "border-l-gold/70",
};

/** Draft Board card — collectible sports card feel (PRD §0B.6):
 *  status, story, live demand, clear CTA, readable in three seconds. */
export function DraftCard({ profile }: { profile: DraftBoardRow }) {
  const hot = profile.pledgedDemandTotal >= 500_00;
  return (
    <Link
      href={`/draft/${profile.id}`}
      className={`card relative block overflow-hidden border-l-4 p-4 ${CATEGORY_EDGE[profile.category] ?? "border-l-edge"} ${hot ? "card-hot" : ""}`}
      style={{ "--glow": "rgb(61 123 255 / 0.3)" } as React.CSSProperties}
    >
      {/* ghost rank numeral — draft board energy */}
      <span aria-hidden className="display pointer-events-none absolute -right-2 -top-6 select-none text-[110px] leading-none text-chalk/[0.045]">
        {profile.rank}
      </span>
      <div className="relative flex items-start justify-between">
        <span className="stat text-sm text-muted">#{String(profile.rank).padStart(2, "0")} DRAFT</span>
        {profile.claimStatus === "UNCLAIMED" ? (
          <span className="stamp border-volt text-volt">Unclaimed</span>
        ) : profile.claimStatus === "CLAIMED" ? (
          <span className="chip bg-lime text-ink">Claimed ✓</span>
        ) : (
          <span className="chip border border-chrome/40 bg-chrome/10 text-chrome">Claim in progress</span>
        )}
      </div>
      <div className="relative mt-2 flex items-center gap-3">
        <Monogram
          name={profile.nameOrHandle}
          size="md"
          ring={profile.claimStatus === "CLAIMED" ? "live" : "draft"}
          morph={`draft-${profile.id}`}
        />
        <div className="min-w-0">
          <h3 className="display truncate text-3xl">{profile.nameOrHandle}</h3>
          <p className="text-sm text-muted">{CATEGORY_LABELS[profile.category]} · nominated by fans</p>
        </div>
      </div>
      {profile.reasonNominated ? (
        <p className="relative mt-2 line-clamp-2 text-sm text-chrome">{profile.reasonNominated}</p>
      ) : null}
      <dl className="relative mt-3 grid grid-cols-3 gap-2 border-t border-edge pt-3 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted">Fans waiting</dt>
          <dd className="stat font-bold text-chalk">{num(profile.fanCount)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted">Pledged</dt>
          <dd className="stat font-bold text-lime">{money(profile.pledgedDemandTotal, { compact: true })}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted">Scouts</dt>
          <dd className="stat font-bold text-volt">{profile.scoutCount}</dd>
        </div>
      </dl>
      {profile.requestedMission ? (
        <p className="relative mt-2 text-xs text-muted">
          Top requested mission: <span className="text-gold">{profile.requestedMission}</span>
        </p>
      ) : null}
    </Link>
  );
}
