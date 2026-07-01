import Link from "next/link";
import { copy, draft, missions as missionsMod, scores, streetteam } from "@famerace/core";
import { prisma } from "@famerace/db";
import { DraftCard } from "@/components/draft-card";
import { LiveFeed } from "@/components/live-feed";
import { FuelBar, SectionTitle, Stat } from "@/components/ui";
import { money, num } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Homepage = live command center (PRD §0B.5): scoreboard + modules. */
export default async function HomePage() {
  const [user, scoreboard, liveCreators, launching, board, nearFunding, scouts, crews] =
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
        orderBy: { launchAt: "asc" },
        take: 3,
      }),
      draft.draftBoard(),
      missionsMod.missionsNearFunding(3),
      scores.topScouts(5),
      streetteam.crewLeaderboard(5),
    ]);

  return (
    <div>
      {/* Hero + scoreboard (PRD §0A.8) */}
      <section className="py-10 text-center">
        <p className="chip mx-auto border border-lime/40 bg-lime/10 text-lime">Genesis Draft</p>
        <h1 className="display mx-auto mt-4 max-w-3xl text-5xl md:text-7xl">
          100 Future Stars. 30 Days. The Internet Decides.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted">{copy.oneLiner}</p>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Pledged" value={money(scoreboard.pledgedCents, { compact: true })} accent="text-lime" />
          <Stat label="Early backers" value={num(scoreboard.backers)} />
          <Stat label="Creators claimed" value={num(scoreboard.claimed)} accent="text-volt" />
          <Stat label="Missions funded" value={num(scoreboard.missionsFunded)} accent="text-gold" />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/draft" className="rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110">
            Open the Draft Board
          </Link>
          <Link href="/nominate" className="rounded border border-volt px-6 py-3 font-bold uppercase tracking-wide text-volt hover:bg-volt/10">
            Nominate a creator
          </Link>
          {!user ? (
            <Link href="/join" className="rounded border border-edge px-6 py-3 font-bold uppercase tracking-wide text-chalk hover:border-lime">
              Join
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {liveCreators.length > 0 ? (
            <section>
              <SectionTitle right={<Link href="/live" className="text-xs uppercase text-muted hover:text-chalk">All live →</Link>}>
                Live now
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                {liveCreators.map((creator) => (
                  <Link key={creator.id} href={`/c/${creator.handle}`} className="card block p-4 hover:border-lime">
                    <p className="stat text-xs text-muted">${creator.market?.ticker}</p>
                    <h3 className="display text-2xl">{creator.displayName}</h3>
                    <p className="stat mt-2 text-lime">{money(creator.market?.priceCents ?? 0)}</p>
                    <p className="text-xs text-muted">{num(creator.market?.holderCount ?? 0)} holders</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {launching.length > 0 ? (
            <section>
              <SectionTitle right={<Link href="/launching" className="text-xs uppercase text-muted hover:text-chalk">Calendar →</Link>}>
                Launching soon
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                {launching.map((creator) => (
                  <Link key={creator.id} href={`/c/${creator.handle}`} className="card block p-4 hover:border-lime">
                    <h3 className="display text-2xl">{creator.displayName}</h3>
                    <p className="mt-1 text-xs uppercase tracking-wide text-lime">confirmation window open</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section>
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
            <section>
              <SectionTitle right={<Link href="/missions" className="text-xs uppercase text-muted hover:text-chalk">All missions →</Link>}>
                Missions near funding
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                {nearFunding.map((mission) => {
                  const pct = Math.min(100, Math.round((mission.fundedCents / mission.goalCents) * 100));
                  return (
                    <Link key={mission.id} href={`/m/${mission.id}`} className="card block p-4 hover:border-gold">
                      <p className="text-xs text-muted">{mission.creator.displayName}</p>
                      <h3 className="font-bold text-chalk">{mission.title}</h3>
                      <div className="mt-2">
                        <FuelBar value={mission.fundedCents} max={mission.goalCents} />
                        <p className="stat mt-1 text-xs text-gold">{pct}% funded</p>
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
            <section className="card p-4">
              <SectionTitle right={<Link href="/scouts" className="text-xs uppercase text-muted hover:text-chalk">All →</Link>}>
                Top scouts
              </SectionTitle>
              <ul className="space-y-1.5 text-sm">
                {scouts.map((scout, index) => (
                  <li key={scout.user!.id} className="flex justify-between">
                    <Link href={`/u/${scout.user!.username}`} className="text-volt">
                      #{index + 1} @{scout.user!.username}
                    </Link>
                    <span className="stat text-muted">{scout.claimed} claimed</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {crews.length > 0 ? (
            <section className="card p-4">
              <SectionTitle right={<Link href="/crews" className="text-xs uppercase text-muted hover:text-chalk">All →</Link>}>
                Top crews
              </SectionTitle>
              <ul className="space-y-1.5 text-sm">
                {crews.map((crew, index) => (
                  <li key={crew.id} className="flex justify-between">
                    <Link href={`/crews/${crew.id}`} className="text-volt">
                      #{index + 1} {crew.name}
                    </Link>
                    <span className="stat text-muted">{num(crew.score)} pts</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {user ? (
            <Link href="/roster" className="card block p-4 text-center hover:border-pink">
              <p className="display text-xl text-pink">My Roster →</p>
              <p className="mt-1 text-xs text-muted">Your picks, your Taste Score, your proof.</p>
            </Link>
          ) : null}
        </div>
      </div>
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
