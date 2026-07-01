import Link from "next/link";
import { missions as missionsMod } from "@famerace/core";
import { prisma } from "@famerace/db";
import { EmptyState, FuelBar, SectionTitle } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  await missionsMod.expireMissions(); // opportunistic deadline sweep
  const [missions, matchFund] = await Promise.all([
    missionsMod.missionsNearFunding(24),
    prisma.matchFund.findFirst({ where: { active: true } }),
  ]);

  return (
    <div>
      <SectionTitle>Missions near funding</SectionTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Concrete career moves, funded by fans. When a mission closes, the proof gets posted — and the
        backers keep the credit forever.
      </p>
      {matchFund ? (
        <div className="card mb-6 border-gold/40 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="display text-xl text-gold">FameRace Match — {matchFund.seasonName}</h2>
            <p className="stat text-sm text-muted">
              {money(matchFund.spentCents, { compact: true })} matched of{" "}
              {money(matchFund.totalCents, { compact: true })}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted">
            Every $1 into an eligible mission gets +${matchFund.matchRatio.toFixed(2)} from the Match
            Fund, up to per-creator caps. We fund outcomes, not prices.
          </p>
          <div className="mt-2">
            <FuelBar value={matchFund.spentCents} max={matchFund.totalCents} />
          </div>
        </div>
      ) : null}
      {missions.length === 0 ? (
        <EmptyState title="No live missions" hint="Missions launch alongside creators — watch the calendar." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((mission) => {
            const pct = Math.min(100, Math.round((mission.fundedCents / mission.goalCents) * 100));
            return (
              <Link key={mission.id} href={`/m/${mission.id}`} className="card block p-5 transition hover:border-gold">
                <p className="text-xs text-muted">{mission.creator.displayName}</p>
                <h3 className="display mt-1 text-2xl">{mission.title}</h3>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="stat text-gold">{money(mission.fundedCents, { compact: true })}</span>
                    <span className="stat text-muted">{pct}%</span>
                  </div>
                  <FuelBar value={mission.fundedCents} max={mission.goalCents} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
