import Link from "next/link";
import { redirect } from "next/navigation";
import { roster as rosterMod, scores } from "@famerace/core";
import { SectionTitle, Stat, StatusChip } from "@/components/ui";
import { CATEGORY_LABELS, money, num } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** My Roster (PRD §0A.14): fantasy-league identity, never "portfolio". */
export default async function RosterPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  let data = await rosterMod.rosterFor(user.id);
  if (!data.taste) {
    // First visit: compute scores opportunistically (a worker owns this in prod).
    await scores.computeAllTasteScores();
    data = await rosterMod.rosterFor(user.id);
  }
  const taste = data.taste ?? (await scores.latestTasteScore(user.id));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-5xl">My Roster</h1>
          <p className="mt-1 text-sm text-muted">
            Taste Score: <span className="stat font-bold text-lime">{taste?.score ?? 0}</span>
            {taste ? (
              <>
                {" "}
                · Early Rank <span className="stat text-chalk">#{num(taste.rank)}</span>
              </>
            ) : null}
          </p>
        </div>
        <a
          href={`/card/roster/${user.username}`}
          target="_blank"
          className="rounded bg-pink px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110"
        >
          Generate Roster Card
        </a>
      </div>

      <div className="card mt-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Creators backed" value={num(data.stats.backedCount)} accent="text-lime" />
        <Stat label="Genesis passes" value={num(data.stats.passCount)} accent="text-gold" />
        <Stat label="Missions funded" value={num(data.stats.missionsFunded)} />
        <Stat label="On roster" value={num(data.entries.length)} />
      </div>

      {taste && Array.isArray(taste.drivers) && (taste.drivers as { label: string; points: number }[]).length > 0 ? (
        <section className="card mt-6 p-5">
          <SectionTitle
            right={
              <a href={`/card/taste_score/${user.username}`} target="_blank" className="text-xs uppercase text-muted hover:text-lime">
                Share card →
              </a>
            }
          >
            Taste Score drivers
          </SectionTitle>
          <ul className="space-y-1 text-sm">
            {(taste.drivers as { label: string; points: number }[]).map((driver) => (
              <li key={driver.label} className="flex justify-between">
                <span className="text-chrome">{driver.label}</span>
                <span className="stat font-bold text-lime">+{driver.points}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SectionTitle>The lineup</SectionTitle>
      {data.entries.length === 0 ? (
        <p className="card p-6 text-sm text-muted">
          Empty roster. Go find your first future star on the{" "}
          <Link href="/draft" className="text-volt underline">
            Draft Board
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.entries.map(({ entry, creator, draft, backed }) => {
            const href = creator ? `/c/${creator.handle}` : draft ? `/draft/${draft.id}` : "#";
            const name = creator?.displayName ?? draft?.nameOrHandle ?? "Unknown";
            const category = creator?.category ?? draft?.category;
            return (
              <Link key={entry.id} href={href} className="card block p-4 hover:border-pink">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted">{category ? CATEGORY_LABELS[category] : ""}</p>
                    <h3 className="display text-2xl">{name}</h3>
                  </div>
                  {backed ? (
                    <span className="chip bg-lime/15 text-lime">Backed</span>
                  ) : creator ? (
                    <StatusChip status={creator.status} />
                  ) : (
                    <span className="chip bg-volt/15 text-volt">Watching</span>
                  )}
                </div>
                {creator?.market ? (
                  <p className="stat mt-2 text-sm text-muted">
                    ${creator.market.ticker} · {money(creator.market.priceCents)} · Fame {creator.fameScore}
                  </p>
                ) : draft ? (
                  <p className="stat mt-2 text-sm text-muted">
                    {num(draft.fanCount)} fans waiting · {money(draft.pledgedDemandTotal, { compact: true })} pledged
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
