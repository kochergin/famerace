import Link from "next/link";
import { battles as battlesMod, calls as callsMod, copy, draft, missions as missionsMod, scores, streetteam } from "@famerace/core";
import { prisma } from "@famerace/db";
import { BattleStrip } from "@/components/battle-strip";
import { OddsBar } from "@/components/call-card";
import { CountUp } from "@/components/count-up";
import { Countdown } from "@/components/countdown";
import { DraftCard } from "@/components/draft-card";
import { LiveFeed } from "@/components/live-feed";
import { Monogram } from "@/components/monogram";
import { Sparkline } from "@/components/sparkline";
import { Crowd, StageLights } from "@/components/stage";
import { TiltCard } from "@/components/tilt-card";
import { FuelBar, SectionTitle } from "@/components/ui";
import { money, num } from "@/lib/format";
import { LogoMark } from "@/components/logo";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Homepage = live command center (PRD §0B.5): a broadcast, not a website. */
export default async function HomePage() {
  const [user, scoreboard, liveCreators, launching, board, nearFunding, scouts, crews, tickerEvents, hotCall, battles] =
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
      callsMod.hottestCall(),
      battlesMod.openBattles(),
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
      {/* Hero + scoreboard (PRD §0A.8) — a stage with lights and a crowd */}
      <section className="fade-up relative pb-24 pt-8 text-center sm:pb-28 sm:pt-12">
        <div
          className="pointer-events-none absolute inset-x-0 -top-6 h-96"
          style={{ background: "radial-gradient(60% 90% at 50% 0%, rgb(201 247 58 / 0.09), transparent 70%)" }}
        />
        <StageLights />
        <p className="chip mx-auto border border-lime/40 bg-lime/10 text-lime">Genesis Draft · Season 1</p>
        <h1 className="display mx-auto mt-5 max-w-4xl text-5xl sm:text-7xl md:text-[92px]">
          100 Future Stars.
          <br />
          30 Days.
          <br />
          <span className="display-hot">The Internet Decides.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">{copy.oneLiner}</p>

        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-6 sm:mt-10 sm:grid-cols-4">
          <Scoreboard label="Pledged" cents value={scoreboard.pledgedCents} accent="text-lime" />
          <Scoreboard label="Early backers" value={scoreboard.backers} accent="text-chalk" />
          <Scoreboard label="Creators claimed" value={scoreboard.claimed} accent="text-volt" />
          <Scoreboard label="Missions funded" value={scoreboard.missionsFunded} accent="text-gold" />
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3 sm:mt-10">
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
        <p className="mt-5 text-sm text-muted">
          Are you a creator?{" "}
          <Link href="/creators" className="font-bold text-lime hover:brightness-110">
            Launch your race →
          </Link>
        </p>
        <Crowd />
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

      {/* How it works — not three cards: one track. The line runs scout →
          back → rise and ends at the flag, because that's where every story
          on this site is headed. */}
      <div className="fade-up relative mb-12">
        <div
          aria-hidden
          className="absolute left-[10%] right-[7%] top-5 hidden h-px sm:block"
          style={{ background: "linear-gradient(90deg, rgb(61 123 255 / 0.5), rgb(201 247 58 / 0.5), rgb(240 195 60 / 0.6))" }}
        />
        <span aria-hidden className="absolute right-[3.5%] top-5 hidden -translate-y-1/2 sm:block">
          <LogoMark className="h-7 w-7" />
        </span>
        <div className="grid gap-6 sm:grid-cols-3 sm:gap-3">
          {HOW.map((step, index) => (
            <div key={step.title} className="flex items-start gap-3 sm:block sm:pr-6">
              <span
                className={`relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-ink ${step.frame}`}
              >
                {step.glyph}
              </span>
              <div className="sm:mt-3">
                <p className="stat text-[10px] uppercase tracking-widest text-muted">Step {index + 1}</p>
                <h3 className={`display text-2xl ${step.tint}`}>{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {liveCreators.length > 0 ? (
            <section className="fade-up">
              <SectionTitle right={<Link href="/live" className="text-xs uppercase text-muted hover:text-chalk">All live →</Link>}>
                Live now
              </SectionTitle>
              <div className={`grid gap-3 ${liveCreators.length === 1 ? "" : "sm:grid-cols-2"}`}>
                {liveCreators.map((creator) => (
                  <TiltCard key={creator.id}>
                    <Link
                      href={`/c/${creator.handle}`}
                      className="card spotlight block p-5"
                      style={{ "--glow": "rgb(201 247 58 / 0.25)" } as React.CSSProperties}
                    >
                      <div className="flex items-center gap-4">
                        <Monogram
                          name={creator.displayName}
                          src={creator.avatarUrl}
                          size="lg"
                          ring="live"
                          morph={creator.handle}
                        />
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
                  </TiltCard>
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
                  <TiltCard key={creator.id}>
                  <Link href={`/c/${creator.handle}`} className="card block p-5" style={{ "--glow": "rgb(201 247 58 / 0.2)" } as React.CSSProperties}>
                    <div className="flex flex-wrap items-center gap-4">
                      <Monogram
                        name={creator.displayName}
                        src={creator.avatarUrl}
                        size="lg"
                        ring="draft"
                        morph={creator.handle}
                      />
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
                  </TiltCard>
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
              <div className={`grid gap-3 ${nearFunding.length === 1 ? "" : nearFunding.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
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
          {battles[0] ? <BattleStrip battle={battles[0]} /> : null}
          {hotCall ? (
            <Link
              href="/calls"
              className="card spotlight fade-up block p-4"
              style={{ "--spot": "rgb(201 247 58 / 0.12)", "--glow": "rgb(201 247 58 / 0.3)" } as React.CSSProperties}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="stat text-[10px] uppercase tracking-widest text-muted">The internet says</span>
                <span className="chip bg-lime/15 text-lime">LIVE CALL</span>
              </div>
              <div className="flex items-center gap-2">
                <Monogram name={hotCall.creator.displayName} src={hotCall.creator.avatarUrl} size="sm" />
                <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-chalk">{hotCall.question}</p>
              </div>
              <div className="mt-3">
                <OddsBar yesPoints={hotCall.yesPoints} noPoints={hotCall.noPoints} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {num(hotCall.yesPoints + hotCall.noPoints)} Taste Points staked — make the call →
              </p>
            </Link>
          ) : null}
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
                      <Monogram name={scout.user!.username} src={scout.user!.avatarUrl} size="sm" />
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
            <>
              <Link href="/roster" className="card block p-4 text-center" style={{ "--glow": "rgb(255 61 141 / 0.3)" } as React.CSSProperties}>
                <p className="display text-xl text-pink">My Roster →</p>
                <p className="mt-1 text-xs text-muted">Your picks, your Taste Score, your proof.</p>
              </Link>
              <Link href="/recap" className="card spotlight block p-4 text-center" style={{ "--spot": "rgb(255 61 141 / 0.14)", "--glow": "rgb(255 61 141 / 0.3)" } as React.CSSProperties}>
                <p className="display text-xl text-chalk">▶ Season Recap</p>
                <p className="mt-1 text-xs text-muted">Your season so far — as a story. ~30s.</p>
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const HOW = [
  {
    title: "Scout",
    text: "Spot a rising creator and nominate them to the Draft Board — or pledge to someone already on it.",
    tint: "text-volt",
    frame: "border-volt/40 bg-volt/10 text-volt",
    spot: "rgb(61 123 255 / 0.1)",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" strokeDasharray="2.4 3" />
        <path d="M12 12l5.5-5.5" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Back",
    text: "When they claim, confirmed demand clears one opening auction — every market opens with a crowd.",
    tint: "text-lime",
    frame: "border-lime/40 bg-lime/10 text-lime",
    spot: "rgb(201 247 58 / 0.1)",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M3 19c4-1 6-3 7.5-7.5C12 7 15 4.5 21 4" strokeLinecap="round" />
        <path d="M16.5 4H21v4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 21h18" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    title: "Rise",
    text: "Fund missions, unlock Backstage, climb the FameRace 100 — your early call is permanent proof.",
    tint: "text-gold",
    frame: "border-gold/40 bg-gold/10 text-gold",
    spot: "rgb(240 195 60 / 0.1)",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M5 8l3.5 3L12 5l3.5 6L19 8l-1.2 9.5a2 2 0 0 1-2 1.5H8.2a2 2 0 0 1-2-1.5z" strokeLinejoin="round" />
        <path d="M9.5 15h5" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
] as const;

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
