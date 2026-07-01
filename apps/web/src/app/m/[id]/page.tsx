import Link from "next/link";
import { notFound } from "next/navigation";
import { missions as missionsMod, DomainError } from "@famerace/core";
import { FuelBar, SectionTitle, Stat, StatusChip } from "@/components/ui";
import { money, num, timeAgo } from "@/lib/format";
import { ShareRow } from "@/components/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mission = await missionsMod.missionDetail(id).catch(() => null);
  if (!mission) return {};
  const image = `/card/mission/${id}/png`;
  return {
    title: `${mission.title} — ${mission.creator.displayName} on FameRace`,
    description: mission.useOfFunds,
    openGraph: { images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mission = await missionsMod.missionDetail(id).catch((e) => {
    if (e instanceof DomainError) return null;
    throw e;
  });
  if (!mission) notFound();
  const pct = Math.min(100, Math.round((mission.fundedCents / mission.goalCents) * 100));
  const tiers = Array.isArray(mission.rewardTiers)
    ? (mission.rewardTiers as { thresholdCents: number; reward: string }[])
    : [];
  const daysLeft = Math.max(0, Math.ceil((mission.deadline.getTime() - Date.now()) / 86_400_000));

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-muted">
        Mission by{" "}
        <Link href={`/c/${mission.creator.handle}`} className="font-semibold text-volt underline">
          {mission.creator.displayName}
        </Link>
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="display text-5xl">{mission.title}</h1>
        <StatusChip status={mission.status} />
      </div>
      <div className="mt-3">
        <ShareRow
          text={`${mission.creator.displayName}'s mission "${mission.title}" is ${pct}% funded on FameRace. Back the rise.`}
          path={`/m/${mission.id}`}
          cardPath={`/card/mission/${mission.id}/png`}
        />
      </div>

      <div className="card mt-6 p-6">
        <div className="mb-2 flex justify-between text-sm">
          <span className="stat font-bold text-gold">{money(mission.fundedCents)}</span>
          <span className="stat text-muted">of {money(mission.goalCents)} · {pct}%</span>
        </div>
        <FuelBar value={mission.fundedCents} max={mission.goalCents} />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Stat label="Backers" value={num(new Set(mission.contributions.map((c) => c.userId)).size)} />
          <Stat label="Days left" value={mission.status === "LIVE" ? daysLeft : "—"} />
          <Stat label="Match fund" value={mission.matchCents > 0 ? money(mission.matchCents) : "—"} accent="text-gold" />
        </div>
        <p className="mt-4 border-t border-edge pt-4 text-sm text-chrome">
          <span className="font-bold uppercase tracking-wide text-muted">Use of funds: </span>
          {mission.useOfFunds}
        </p>
        {mission.status === "LIVE" ? (
          <Link
            href={`/c/${mission.creator.handle}`}
            className="mt-4 block rounded bg-gold px-4 py-3 text-center font-bold uppercase tracking-wide text-ink hover:brightness-110"
          >
            Fund this mission
          </Link>
        ) : null}
      </div>

      {tiers.length > 0 ? (
        <section className="card mt-6 p-6">
          <SectionTitle>Reward tiers</SectionTitle>
          <ul className="space-y-2 text-sm">
            {tiers.map((tier) => (
              <li key={tier.reward} className="flex justify-between rounded border border-edge px-3 py-2">
                <span className="text-chrome">{tier.reward}</span>
                <span className="stat font-bold text-gold">{money(tier.thresholdCents)}+</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card mt-6 p-6">
        <SectionTitle>Updates &amp; proof</SectionTitle>
        {mission.updates.length === 0 ? (
          <p className="text-sm text-muted">No updates yet.</p>
        ) : (
          <div className="space-y-3">
            {mission.updates.map((update) => (
              <article key={update.id} className="rounded border border-edge p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-bold text-chalk">{update.title}</h3>
                  <span className="text-xs text-muted">{timeAgo(update.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-chrome">{update.body}</p>
                {update.proofUrl ? (
                  <a href={update.proofUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-lime underline">
                    View proof ↗
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-6 p-6">
        <SectionTitle>Top supporters</SectionTitle>
        {mission.contributions.length === 0 ? (
          <p className="text-sm text-muted">Be the first to fund this.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {mission.contributions.map((contribution) => (
              <li key={contribution.id} className="flex justify-between">
                <Link href={`/u/${contribution.user.username}`} className="text-volt">
                  @{contribution.user.username}
                </Link>
                <span className="stat text-gold">{money(contribution.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
