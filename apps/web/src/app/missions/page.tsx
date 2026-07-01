import Link from "next/link";
import { missions as missionsMod } from "@famerace/core";
import { EmptyState, FuelBar, SectionTitle } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  await missionsMod.expireMissions(); // opportunistic deadline sweep
  const missions = await missionsMod.missionsNearFunding(24);

  return (
    <div>
      <SectionTitle>Missions near funding</SectionTitle>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Concrete career moves, funded by fans. When a mission closes, the proof gets posted — and the
        backers keep the credit forever.
      </p>
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
