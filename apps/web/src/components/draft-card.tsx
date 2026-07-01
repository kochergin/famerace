import Link from "next/link";
import type { DraftBoardRow } from "@famerace/core";
import { CATEGORY_LABELS, money, num } from "@/lib/format";
import { StatusChip } from "./ui";

/** Draft Board card — collectible sports card feel (PRD §0B.6):
 *  status, story, live demand, clear CTA, readable in three seconds. */
export function DraftCard({ profile }: { profile: DraftBoardRow }) {
  const hot = profile.pledgedDemandTotal >= 500_000;
  return (
    <Link
      href={`/draft/${profile.id}`}
      className={`card block p-4 transition hover:border-volt ${hot ? "card-hot" : ""}`}
    >
      <div className="flex items-start justify-between">
        <span className="stat text-sm text-muted">#{String(profile.rank).padStart(2, "0")} DRAFT</span>
        {profile.claimStatus === "UNCLAIMED" ? (
          <span className="stamp border-volt text-volt">Unclaimed</span>
        ) : (
          <StatusChip status={profile.claimStatus} />
        )}
      </div>
      <h3 className="display mt-2 text-3xl">{profile.nameOrHandle}</h3>
      <p className="text-sm text-muted">
        {CATEGORY_LABELS[profile.category]} · nominated by fans
      </p>
      {profile.reasonNominated ? (
        <p className="mt-2 line-clamp-2 text-sm text-chrome">{profile.reasonNominated}</p>
      ) : null}
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-edge pt-3 text-center">
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
        <p className="mt-2 text-xs text-muted">
          Top requested mission: <span className="text-gold">{profile.requestedMission}</span>
        </p>
      ) : null}
    </Link>
  );
}
