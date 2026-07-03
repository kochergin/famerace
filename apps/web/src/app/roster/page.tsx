import Link from "next/link";
import { redirect } from "next/navigation";
import { roster as rosterMod, scores } from "@famerace/core";
import { Monogram } from "@/components/monogram";
import { EmptyRow, Gauge, SectionTitle, Stat, StatusChip } from "@/components/ui";
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
      <div className="card spotlight fade-up flex flex-wrap items-center justify-between gap-6 p-6" style={{ "--spot": "rgb(201 247 58 / 0.1)" } as React.CSSProperties}>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Gauge
            score={taste?.score ?? 0}
            label="Taste Score"
            sub={taste ? `Rank #${num(taste.rank)}` : undefined}
          />
          <div className="min-w-0">
            <h1 className="display text-4xl sm:text-6xl">My Roster</h1>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Find them early. Back their rise. This is the proof.
            </p>
          </div>
        </div>
        {data.entries.length > 0 ? (
          <a
            href={`/card/roster/${user.username}`}
            target="_blank"
            className="rounded bg-pink px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-ink shadow-[0_0_20px_rgba(255,61,141,0.35)] transition hover:brightness-110"
          >
            Generate Roster Card
          </a>
        ) : null}
      </div>

      {data.stats.backedCount > 0 ? (
      <Link
        href="/recap"
        className="card mt-4 flex items-center justify-between gap-3 border-pink/40 p-4 transition hover:border-pink"
        style={{ "--glow": "rgb(255 61 141 / 0.35)" } as React.CSSProperties}
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-pink text-ink">▶</span>
          <span>
            <span className="display block text-xl text-pink">Play your Season Recap</span>
            <span className="text-xs text-muted">Your calls, your rank, your receipts — as a story.</span>
          </span>
        </span>
        <span className="stat text-xs uppercase tracking-widest text-muted">~30s</span>
      </Link>
      ) : null}

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
        <div className="card p-6">
          <EmptyRow
            glyph="⭐"
            title="Nobody on the lineup yet — your first pick is waiting on the board."
            action={<Link href="/draft" className="text-lime hover:brightness-110">Open the Draft Board →</Link>}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.entries.map(({ entry, creator, draft, backed }) => {
            const href = creator ? `/c/${creator.handle}` : draft ? `/draft/${draft.id}` : "#";
            const name = creator?.displayName ?? draft?.nameOrHandle ?? "Unknown";
            const category = creator?.category ?? draft?.category;
            return (
              <Link key={entry.id} href={href} className="card block p-4" style={{ "--glow": "rgb(255 61 141 / 0.25)" } as React.CSSProperties}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Monogram
                      name={name}
                      src={creator?.avatarUrl}
                      size="md"
                      ring={backed ? "gold" : creator?.status === "LIVE" ? "live" : "draft"}
                      morph={creator ? creator.handle : draft ? `draft-${draft.id}` : undefined}
                    />
                    <div>
                      <p className="text-xs text-muted">{category ? CATEGORY_LABELS[category] : ""}</p>
                      <h3 className="display text-2xl">{name}</h3>
                    </div>
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
