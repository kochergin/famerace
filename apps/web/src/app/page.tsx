import Link from "next/link";
import { copy, draft, missions as missionsMod, scores, streetteam } from "@famerace/core";
import { prisma } from "@famerace/db";
import { CountUp } from "@/components/count-up";
import { Countdown } from "@/components/countdown";
import { DraftCard } from "@/components/draft-card";
import { LiveFeed } from "@/components/live-feed";
import { Monogram } from "@/components/monogram";
import { Sparkline } from "@/components/sparkline";
import { FuelBar, SectionTitle } from "@/components/ui";
import { money, num } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Homepage = live command center (PRD §0B.5): a broadcast, not a website. */
export default async function HomePage() {
  const [user, scoreboard, liveCreators, launching, board, nearFunding, scouts, crews, tickerEvents] =
    await Promise.all([
      currentUser(),
      loadScoreboard(),
      prisma.creator.findMany({
        where: { status: "LIVE" },
        include: { market: true },
        orderBy: { fameScore: "desc" },
        take: 3,
      }),
      prisma.creator.findMany({
        where: { status: "LAUNCHING_SOON" },
        include: { launchThreshold: true },
        orderBy: { launchAt: "asc" },
        take: 3,
      }),
      draft.draftBoard(),
      missionsMod.missionsNearFunding(3),
      scores.topScouts(5),
      streetteam.crewLeaderboard(5),
      prisma.event.findMany({
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 14,
      }),
    ]);

  const sparklines = new Map<string, number[]>();
  for (const creator of liveCreators) {
    if (!creator.market) continue;
    const txs = await prisma.marketTransaction.findMany({
      where: { creatorMarketId: creator.market.id },
      orderBy: { createdAt: "asc" },
      take: 40,
      select: { priceAfterCents: true },
    });
    if (txs.length >= 2) sparklines.set(creator.id, txs.map((t) => t.priceAfterCents));
  }

  return (
    <div>
      {/* Hero + scoreboard (PRD §0A.8) */}
      <section className="fade-up relative py-12 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 -top-6 h-96"
          style={{ background: "radial-gradient(60% 90% at 50% 0%, rgb(201 247 58 / 0.09), transparent 70%)" }}
        />
        <p className="chip mx-auto border border-lime/40 bg-lime/10 text-lime">Genesis Draft · Season 1</p>
        <h1 className="display mx-auto mt-5 max-w-4xl text-5xl sm:text-7xl md:text-[92px]">
          100 Future Stars.
          <br />
          30 Days.
          <br />
          <span className="display-hot">The Internet Decides.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">{copy.oneLiner}</p>

        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          <Scoreboard label="Pledged" cents value={scoreboard.pledgedCents} accent="text-lime" />
          <Scoreboard label="Early backers" value={scoreboard.backers} accent="text-chalk" />
          <Scoreboard label="Creators claimed" value={scoreboard.claimed} accent="text-volt" />
          <Scoreboard label="Missions funded" value={scoreboard.missionsFunded} accent="text-gold" />
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/draft"
            className="rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_28px_rgba(201,247,58,0.35)] transition hover:brightness-110"
          >
            Open the Draft Board
          </Link>
          <Link href="/nominate" className="rounded border border-volt px-6 py-3 font-bold uppercase tracking-wide text-volt transition hover:bg-volt/10">
            Nominate a creator
          </Link>
          {!user ? (
            <Link href="/join" className="rounded border border-edge px-6 py-3 font-bold uppercase tracking-wide text-chalk transition hover:border-lime">
              Join
            </Link>
          ) : null}
        </div>
      </section>

      {/* Ticker tape (§0A.9: live buys scroll as ticker tape) */}
      {tickerEvents.length > 0 ? (
        <div className="mb-10 overflow-hidden border-y border-edge bg-graphite/60 py-2" aria-hidden>
          <div className="marquee gap-10 text-xs text-chrome">
            {[...tickerEvents, ...tickerEvents].map((event, index) => (
              <span key={`${event.id}-${index}`} className="flex shrink-0 items-center gap-2 uppercase tracking-wide">
                <span className="text-lime">●</span>
                {event.message}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {liveCreators.length > 0 ? (
            <section className="fade-up">
              <SectionTitle right={<Link href="/live" className="text-xs uppercase text-muted hover:text-chalk">All live →</Link>}>
                Live now
              </SectionTitle>
              <div className={`grid gap-3 ${liveCreators.length === 1 ? "" : "sm:grid-cols-2"}`}>
                {liveCreators.map((creator) => (
                  <Link
                    key={creator.id}
                    href={`/c/${creator.handle}`}
                    className="card spotlight block p-5"
                    style={{ "--glow": "rgb(201 247 58 / 0.25)" } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-4">
                      <Monogram name={creator.displayName} size="lg" ring="live" />
                      <div className="min-w-0 flex-1">
                        <p className="stat text-xs text-muted">
                          ${creator.market?.ticker} · Fame {creator.fameScore}
                        </p>
                        <h3 className="display truncate text-3xl">{creator.displayName}</h3>
                      </div>
                      <div className="text-right">
                        <p className="stat text-2xl font-bold text-lime">{money(creator.market?.priceCents ?? 0)}</p>
                        <p className="text-xs text-muted">{num(creator.market?.holderCount ?? 0)} holders</p>
                      </div>
                    </div>
                    {sparklines.has(creator.id) ? (
                      <div className="mt-3 border-t border-edge pt-3">
                        <Sparkline points={sparklines.get(creator.id)!} width={560} height={44} className="w-full" />
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {launching.length > 0 ? (
            <section className="fade-up">
              <SectionTitle right={<Link href="/launching" className="text-xs uppercase text-muted hover:text-chalk">Calendar →</Link>}>
                Launching soon
              </SectionTitle>
              <div className={`grid gap-3 ${launching.length === 1 ? "" : "sm:grid-cols-2"}`}>
                {launching.map((creator) => (
                  <Link key={creator.id} href={`/c/${creator.handle}`} className="card block p-5" style={{ "--glow": "rgb(201 247 58 / 0.2)" } as React.CSSProperties}>
                    <div className="flex items-center gap-4">
                      <Monogram name={creator.displayName} size="lg" ring="draft" />
                      <div className="min-w-0 flex-1">
                        <h3 className="display truncate text-3xl">{creator.displayName}</h3>
                        <p className="text-xs uppercase tracking-wide text-muted">
                          {num(creator.launchThreshold?.confirmedBackers ?? 0)} backers ·{" "}
                          {money(creator.launchThreshold?.confirmedDemandCents ?? 0, { compact: true })} confirmed
                        </p>
                      </div>
                      {creator.launchAt ? (
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-widest text-muted">Launch in</p>
                          <Countdown to={creator.launchAt.toISOString()} className="display text-2xl text-lime" />
                        </div>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="fade-up">
            <SectionTitle right={<Link href="/draft" className="text-xs uppercase text-muted hover:text-chalk">Full board →</Link>}>
              Draft board
            </SectionTitle>
            {board.length === 0 ? (
              <p className="card p-6 text-sm text-muted">
                The board is empty — be the first scout to{" "}
                <Link href="/nominate" className="text-volt underline">
                  nominate a rising creator
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {board.slice(0, 4).map((profile) => (
                  <DraftCard key={profile.id} profile={profile} />
                ))}
              </div>
            )}
          </section>

          {nearFunding.length > 0 ? (
            <section className="fade-up">
              <SectionTitle right={<Link href="/missions" className="text-xs uppercase text-muted hover:text-chalk">All missions →</Link>}>
                Missions near funding
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                {nearFunding.map((mission) => {
                  const pct = Math.min(100, Math.round((mission.fundedCents / mission.goalCents) * 100));
                  return (
                    <Link key={mission.id} href={`/m/${mission.id}`} className="card block p-4" style={{ "--glow": "rgb(240 195 60 / 0.25)" } as React.CSSProperties}>
                      <p className="text-xs text-muted">{mission.creator.displayName}</p>
                      <h3 className="font-bold text-chalk">{mission.title}</h3>
                      <div className="mt-3">
                        <FuelBar value={mission.fundedCents} max={mission.goalCents} />
                        <p className="stat mt-1.5 text-sm font-bold text-gold">{pct}% funded</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <LiveFeed />
          {scouts.length > 0 ? (
            <section className="card fade-up p-4">
              <SectionTitle right={<Link href="/scouts" className="text-xs uppercase text-muted hover:text-chalk">All →</Link>}>
                Top scouts
              </SectionTitle>
              <ul className="space-y-2 text-sm">
                {scouts.map((scout, index) => (
                  <li key={scout.user!.id}>
                    <Link href={`/u/${scout.user!.username}`} className="flex items-center gap-2 transition hover:opacity-80">
                      <span className="stat w-5 text-muted">#{index + 1}</span>
                      <Monogram name={scout.user!.username} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-volt">@{scout.user!.username}</span>
                      <span className="stat text-muted">{scout.claimed} claimed</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {crews.length > 0 ? (
            <section className="card fade-up p-4">
              <SectionTitle right={<Link href="/crews" className="text-xs uppercase text-muted hover:text-chalk">All →</Link>}>
                Top crews
              </SectionTitle>
              <ul className="space-y-2 text-sm">
                {crews.map((crew, index) => (
                  <li key={crew.id}>
                    <Link href={`/crews/${crew.id}`} className="flex items-center gap-2 transition hover:opacity-80">
                      <span className="stat w-5 text-muted">#{index + 1}</span>
                      <Monogram name={crew.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-volt">{crew.name}</span>
                      <span className="stat text-muted">{num(crew.score)} pts</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {user ? (
            <Link href="/roster" className="card block p-4 text-center" style={{ "--glow": "rgb(255 61 141 / 0.3)" } as React.CSSProperties}>
              <p className="display text-xl text-pink">My Roster →</p>
              <p className="mt-1 text-xs text-muted">Your picks, your Taste Score, your proof.</p>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Scoreboard({
  label,
  value,
  cents = false,
  accent,
}: {
  label: string;
  value: number;
  cents?: boolean;
  accent: string;
}) {
  return (
    <div>
      <div className={`text-3xl font-bold sm:text-4xl ${accent}`}>
        <CountUp value={cents ? Math.round(value / 100) : value} prefix={cents ? "$" : ""} compact />
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-widest text-muted">{label}</div>
    </div>
  );
}

async function loadScoreboard() {
  const [pledged, backers, claimed, missionsFunded] = await Promise.all([
    prisma.fanDemandOrder.aggregate({
      where: { refundStatus: "NONE", confirmationStatus: { not: "DECLINED" } },
      _sum: { amountCents: true },
    }),
    prisma.user.count({ where: { OR: [{ demandOrders: { some: {} } }, { genesisPasses: { some: {} } }] } }),
    prisma.creator.count({ where: { status: { in: ["APPROVED", "LAUNCHING_SOON", "LIVE"] } } }),
    prisma.mission.count({ where: { status: { in: ["FUNDED", "IN_PROGRESS", "COMPLETED"] } } }),
  ]);
  return {
    pledgedCents: pledged._sum.amountCents ?? 0,
    backers,
    claimed,
    missionsFunded,
  };
}
