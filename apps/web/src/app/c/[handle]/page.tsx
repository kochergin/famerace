import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { battles as battlesMod, calls as callsMod, copy, market as marketMod, supporters as supportersMod } from "@famerace/core";
import { prisma } from "@famerace/db";
import type { CallSide } from "@famerace/db";
import { FormError } from "@/components/form-error";
import { FuelBar, RiskDisclosure, SectionTitle, Stat, StatusChip } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { CATEGORY_LABELS, money, num, timeAgo } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { BackstageSection, DropsSection, MissionSection, TipBox } from "./monetization";
import { StreetTeamSection } from "./street-team";
import { PaidMessageBox, RequestMenuSection } from "./engage";
import { ReportForm } from "@/components/report";
import { ShareRow } from "@/components/share";
import { Arena, nextRoom } from "@/components/arena";
import { Backdrop } from "@/components/backdrop";
import { BattleStrip } from "@/components/battle-strip";
import { BackBox } from "@/components/back-box";
import { CallCard } from "@/components/call-card";
import { LivePulse } from "@/components/live-pulse";
import { CategoryGlyph } from "@/components/category-art";
import { Confetti } from "@/components/confetti";
import { Monogram } from "@/components/monogram";
import { Countdown } from "@/components/countdown";
import { Sparkline } from "@/components/sparkline";
import { Banner } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = await prisma.creator.findUnique({ where: { handle }, select: { displayName: true, bio: true } });
  if (!creator) return {};
  const image = `/card/breakout/${handle}/png`;
  return {
    title: `${creator.displayName} — FameRace`,
    description: creator.bio ?? "Back the rise.",
    openGraph: { images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

async function backAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  let receipt = "";
  await withErrorRedirect(`/c/${handle}`, async () => {
    const marketId = String(formData.get("marketId"));
    const custom = Number(formData.get("customAmount") || 0);
    const tier = Number(formData.get("tier") || 0);
    const spend = custom > 0 ? Math.round(custom * 100) : tier;
    const { quote, chargedCents } = await marketMod.buy(user.id, marketId, spend);
    receipt = `&units=${quote.units}&paid=${(chargedCents / 100).toFixed(2)}`;
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?backed=1${receipt}`);
}

async function sellAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await marketMod.sell(user.id, String(formData.get("marketId")), Number(formData.get("units") || 0));
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?sold=1`);
}

async function passAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await marketMod.purchaseGenesisPass(user.id, String(formData.get("creatorId")), Number(formData.get("tier")));
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?pass=1`);
}

async function callStakeAction(handle: string, formData: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await callsMod.stake(
      user.id,
      String(formData.get("callId")),
      String(formData.get("side")) as CallSide,
      Math.round(Number(formData.get("points") || 0)),
    );
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?called=1`);
}

export default async function CreatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{
    error?: string;
    backed?: string;
    units?: string;
    paid?: string;
    sold?: string;
    pass?: string;
    called?: string;
    messaged?: string;
    requested?: string;
    reported?: string;
  }>;
}) {
  const { handle } = await params;
  const flags = await searchParams;
  const [creator, user] = await Promise.all([
    prisma.creator.findUnique({
      where: { handle },
      include: {
        market: true,
        launchThreshold: true,
        draftProfile: true,
        missions: { where: { status: { in: ["LIVE", "FUNDED", "IN_PROGRESS", "COMPLETED"] } } },
      },
    }),
    currentUser(),
  ]);
  const PRE_LAUNCH = ["CLAIM_STARTED", "VERIFICATION_PENDING", "APPROVED"];
  if (!creator || ![...PRE_LAUNCH, "LAUNCHING_SOON", "LIVE", "PAUSED"].includes(creator.status)) notFound();

  /* Pre-launch: the link works from minute one. The star drops ONE address
     in bio and it shows the right scene at every stage — right now, the
     forming race: pledge, count, share. */
  if (PRE_LAUNCH.includes(creator.status)) {
    const draft = creator.draftProfile;
    return (
      <div className="relative mx-auto max-w-2xl overflow-x-clip py-10 text-center">
        <span aria-hidden className="beam beam-a left-[6%]" />
        <span aria-hidden className="beam beam-pink beam-b right-[6%]" />
        <Monogram name={creator.displayName} src={creator.avatarUrl} size="xl" ring="draft" className="mx-auto" />
        <p className="stat mt-5 text-[10px] uppercase tracking-[0.35em] text-volt">The race is forming</p>
        <h1 className="display mt-2 text-5xl sm:text-6xl">{creator.displayName}</h1>
        <p className="mt-1 text-sm text-muted">{CATEGORY_LABELS[creator.category]} · launching on FameRace</p>
        {draft?.reasonNominated ? (
          <p className="mx-auto mt-4 max-w-md text-sm text-chalk">“{draft.reasonNominated}”</p>
        ) : null}
        <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-4">
          <Stat label="Fans staked" value={num(draft?.fanCount ?? 0)} accent="text-lime" />
          <Stat label="Pledged so far" value={money(draft?.pledgedDemandTotal ?? 0, { compact: true })} accent="text-gold" />
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {creator.draftProfileId ? (
            <Link
              href={`/draft/${creator.draftProfileId}`}
              className="rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.3)] transition hover:brightness-110"
            >
              Stake your place early →
            </Link>
          ) : null}
        </div>
        <p className="mx-auto mt-3 max-w-sm text-xs text-muted">
          Pledges are refundable holds — captured only if the launch clears its threshold. Early
          backers keep their numbers forever.
        </p>
        <div className="mt-8 flex justify-center">
          <ShareRow
            text={`${creator.displayName} is launching on FameRace — stake your place before the world notices.`}
            path={`/c/${handle}`}
          />
        </div>
      </div>
    );
  }
  const m = creator.market;
  const overview = m ? await marketMod.marketOverview(m.id) : null;
  const priceHistory = m
    ? (
        await prisma.marketTransaction.findMany({
          where: { creatorMarketId: m.id },
          orderBy: { createdAt: "asc" },
          take: 60,
          select: { priceAfterCents: true },
        })
      ).map((t) => t.priceAfterCents)
    : [];
  const holding = user && m
    ? await prisma.holding.findUnique({
        where: { userId_creatorMarketId: { userId: user.id, creatorMarketId: m.id } },
      })
    : null;
  const pass = user
    ? await prisma.genesisPass.findUnique({
        where: { userId_creatorId: { userId: user.id, creatorId: creator.id } },
      })
    : null;
  const nextBackerRank =
    m && !holding?.backerRank
      ? (await prisma.holding.count({ where: { creatorMarketId: m.id, backerRank: { not: null } } })) + 1
      : null;
  const perks = Array.isArray(creator.perks) ? (creator.perks as string[]) : [];
  const socials = Array.isArray(creator.socialLinks) ? (creator.socialLinks as string[]) : [];
  const tradeable = m && ["GENESIS_CURVE", "GRADUATION", "MATURE"].includes(m.status);
  const [openCalls, topSupporters, battle, seatCount, unlocks] = await Promise.all([
    callsMod.callsForCreator(creator.id),
    supportersMod.topSupporters(creator.id),
    battlesMod.battleForCreator(creator.id),
    battlesMod.supporterCount(creator.id),
    battlesMod.unlocksFor(creator.id),
  ]);
  const nextUnlock = unlocks.find((u) => !u.unlocked);
  const myCallStakes = user ? await callsMod.stakesFor(user.id, openCalls.map((c) => c.id)) : new Map();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: creator.displayName,
      description: creator.bio ?? undefined,
      image: creator.avatarUrl ? `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://famerace.fun"}${creator.avatarUrl}` : undefined,
      url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://famerace.fun"}/c/${creator.handle}`,
      sameAs: socials,
    },
  };

  return (
    <div className="mx-auto max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {flags.backed || flags.pass ? <Confetti fireKey={flags.backed ? "backed" : "pass"} /> : null}
      <LivePulse creatorId={creator.id} />
      {/* Receipt interstitial: the proof-of-early moment IS the share moment */}
      {flags.backed ? (
        <div className="card spotlight story-in mb-4 border-lime/40 p-5" style={{ "--spot": "rgb(201 247 58 / 0.16)" } as React.CSSProperties}>
          <p className="stat text-[10px] uppercase tracking-[0.3em] text-muted">Receipt · permanent</p>
          <p className="display mt-1 text-3xl">
            You backed {creator.displayName}
            {holding?.backerRank ? (
              <>
                {" "}— <span className="text-lime">backer #{holding.backerRank}</span>. Forever.
              </>
            ) : (
              <span className="text-lime">.</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            {flags.units ? `${flags.units} units for $${flags.paid} · ` : ""}
            Early units cost less — your timestamp is the proof.
          </p>
          <div className="mt-3">
            <ShareRow
              text={
                holding?.backerRank
                  ? `Backer #${holding.backerRank} of ${creator.displayName} on FameRace. Called it early. #BackTheRise`
                  : `I just backed ${creator.displayName} on FameRace. #BackTheRise`
              }
              path={`/c/${handle}`}
              cardPath={holding?.backerRank ? `/card/backer_wall/${handle}` : `/card/breakout/${handle}`}
            />
          </div>
        </div>
      ) : null}
      {flags.pass && pass ? (
        <div className="card spotlight story-in mb-4 border-gold/40 p-5" style={{ "--spot": "rgb(240 195 60 / 0.16)" } as React.CSSProperties}>
          <p className="stat text-[10px] uppercase tracking-[0.3em] text-muted">Genesis Pass · receipt</p>
          <p className="display mt-1 text-3xl">
            On the wall — <span className="text-gold">Genesis Backer #{pass.backerNumber}</span>.
          </p>
          <p className="mt-1 text-xs text-muted">First 500 spots only. Nobody can take the number.</p>
          <div className="mt-3">
            <ShareRow
              text={`Genesis Backer #${pass.backerNumber} of ${creator.displayName} on FameRace. Before the world noticed. #BackTheRise`}
              path={`/c/${handle}`}
              cardPath={`/card/backer/${handle}`}
            />
          </div>
        </div>
      ) : null}
      {flags.sold ? <Banner tone="chrome">Sold back to the curve. Your backer rank stays yours.</Banner> : null}
      {flags.messaged ? <Banner tone="chrome">Paid message sent — respond-to-earn, decline-to-refund.</Banner> : null}
      {flags.requested ? <Banner tone="gold">Request placed. Funds sit in escrow until delivery.</Banner> : null}
      {flags.called ? (
        <>
          <Confetti fireKey="called" />
          <Banner tone="lime">
            Call placed — it resolves automatically at the deadline. Being right pays from the other
            side of the board.
          </Banner>
        </>
      ) : null}
      {flags.reported ? <Banner tone="chrome">Report received. Trust &amp; safety will review it.</Banner> : null}
      <FormError error={flags.error} />

      {/* Hero (PRD §0B.7: a stage, not just a chart) — their own art lights the room */}
      <div
        className="card spotlight fade-up relative isolate overflow-hidden p-6"
        style={{ "--spot": creator.status === "LIVE" ? "rgb(201 247 58 / 0.13)" : "rgb(61 123 255 / 0.13)" } as React.CSSProperties}
      >
        <Backdrop name={creator.displayName} src={creator.avatarUrl} />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-5">
            <Monogram
              name={creator.displayName}
              src={creator.avatarUrl}
              size="xl"
              ring={creator.status === "LIVE" ? "live" : "draft"}
              morph={creator.handle}
              className="mt-1"
            />
            <div>
            <p className="stat flex items-center gap-1.5 text-sm text-muted">
              {m ? `$${m.ticker} · ` : ""}
              <CategoryGlyph category={creator.category} className="h-3.5 w-3.5" />
              {CATEGORY_LABELS[creator.category]}
            </p>
            <h1 className="display mt-1 text-6xl md:text-7xl">{creator.displayName}</h1>
            {creator.bio ? <p className="mt-2 max-w-xl text-chrome">{creator.bio}</p> : null}
            {socials.length ? (
              <p className="mt-2 space-x-3 text-sm">
                {socials.map((link) => (
                  <a key={link} href={link} target="_blank" rel="noreferrer nofollow" className="text-volt underline">
                    {new URL(link).hostname.replace("www.", "")} ↗
                  </a>
                ))}
              </p>
            ) : null}
            </div>
          </div>
          <StatusChip status={creator.status === "LIVE" && m?.status === "PAUSED" ? "PAUSED" : creator.status} />
        </div>

        {creator.status === "LAUNCHING_SOON" && creator.launchAt ? (
          <div className="mt-6 rounded border border-lime/40 bg-lime/5 p-5 text-center">
            <p className="stat text-[10px] uppercase tracking-[0.3em] text-lime">The campaign · all or nothing</p>
            <Countdown to={creator.launchAt.toISOString()} className="display mt-1 block text-6xl text-lime" />
            {creator.launchThreshold ? (
              <div className="mx-auto mt-4 max-w-md">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="stat font-bold text-chalk">
                    {num(creator.launchThreshold.confirmedBackers)} / {num(creator.launchThreshold.requiredBackers)} backers confirmed
                  </span>
                  <span className="stat text-muted">
                    {Math.max(0, creator.launchThreshold.requiredBackers - creator.launchThreshold.confirmedBackers)} to go
                  </span>
                </div>
                <div className="mt-1.5">
                  <FuelBar value={creator.launchThreshold.confirmedBackers} max={creator.launchThreshold.requiredBackers} />
                </div>
              </div>
            ) : null}
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              Opening auction clears all confirmed demand through one fair fill. Miss the threshold and
              every pledge is released — no empty launches, ever.
            </p>
          </div>
        ) : null}

        {m ? (
          <div className={`mt-6 grid grid-cols-2 gap-4 border-t border-edge pt-4 ${creator.followerCount > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
            <Stat label="Price" value={money(m.priceCents)} accent="text-lime" />
            <Stat label="Holders" value={num(m.holderCount)} />
            <Stat label="Supply" value={num(m.supplyUnits)} />
            <Stat label="Volume" value={money(m.volumeTotalCents, { compact: true })} />
            {creator.followerCount > 0 ? <Stat label="Followers" value={num(creator.followerCount)} accent="text-pink" /> : null}
          </div>
        ) : null}
        {priceHistory.length >= 2 ? (
          <div className="mt-4">
            <Sparkline points={priceHistory} width={900} height={64} className="w-full" />
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted">
              Price since launch · blue dot = opening auction
            </p>
          </div>
        ) : null}
        <div className="mt-4 border-t border-edge pt-4">
          <ShareRow
            text={`Back the rise: ${creator.displayName} is live on FameRace.`}
            path={`/c/${handle}`}
            cardPath={`/card/breakout/${handle}/png`}
          />
        </div>
      </div>

      {battle ? (
        <div className="mt-6">
          <BattleStrip battle={battle} focusHandle={handle} />
        </div>
      ) : null}

      {/* The arena, public: the collective goal every new backer moves */}
      {creator.status === "LIVE" && (seatCount > 0 || nextUnlock) ? (
        <section className="card spotlight mt-6 p-5" style={{ "--spot": "rgb(201 247 58 / 0.1)" } as React.CSSProperties}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>The arena</SectionTitle>
            <p className="stat text-xs text-muted">
              <span className="font-bold text-lime">{num(seatCount)}</span> {seatCount === 1 ? "seat" : "seats"} lit
              {nextRoom(seatCount) ? <> · next room: <span className="font-bold text-gold">{nextRoom(seatCount)!.label}</span></> : null}
            </p>
          </div>
          <Arena lit={seatCount} className="mx-auto w-full max-w-md" />
          {nextUnlock ? (
            <div className="mt-2 rounded border border-gold/40 bg-gold/10 px-3 py-2.5 text-center">
              <p className="text-sm text-chalk">
                🔓 At <span className="stat font-bold text-gold">{num(nextUnlock.atSeats)}</span> seats{" "}
                {creator.displayName} unlocks: <span className="font-bold">{nextUnlock.title}</span>
              </p>
              <p className="stat mt-0.5 text-[11px] uppercase tracking-widest text-muted">
                {Math.max(0, nextUnlock.atSeats - seatCount)} seats to go — every backer counts
              </p>
            </div>
          ) : null}
          {unlocks.filter((u) => u.unlocked).length > 0 ? (
            <p className="mt-2 text-center text-xs text-muted">
              Already unlocked by this crowd: {unlocks.filter((u) => u.unlocked).map((u) => u.title).join(" · ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {creator.story ? (
        <section className="card mt-6 p-6">
          <SectionTitle>The story</SectionTitle>
          <p className="whitespace-pre-line text-chrome">{creator.story}</p>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Back (buy) — §0B.8 trade sheet */}
        {tradeable && m ? (
          <section className="card flex flex-col p-6">
            <SectionTitle>{copy.cta.back(creator.displayName)}</SectionTitle>
            {user ? (
              <BackBox
                action={backAction}
                handle={handle}
                marketId={m.id}
                ticker={m.ticker}
                curve={{ basePriceCents: m.basePriceCents, slopeMilliCents: m.slopeMilliCents }}
                supply={m.supplyUnits}
                feeBps={{ creator: m.creatorFeeBps, protocol: m.protocolFeeBps, scout: m.scoutFeeBps }}
                nextBackerRank={nextBackerRank}
              >
                <RiskDisclosure
                  confirmLabel={copy.cta.back(creator.displayName)}
                  feeLine={copy.feeDisclosure(m.creatorFeeBps, m.protocolFeeBps, m.scoutFeeBps)}
                />
              </BackBox>
            ) : (
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {[2500, 10000, 50000].map((cents) => (
                    <span key={cents} className="stat inline-block rounded border border-edge px-4 py-2 text-sm font-bold text-muted">
                      {money(cents)}
                    </span>
                  ))}
                </div>
                <ul className="spark-list text-xs text-muted">
                  <li>${m.ticker} access/status units on the live curve</li>
                  <li>Permanent backer rank on first back</li>
                  <li>Holder-gated Backstage eligibility</li>
                </ul>
                <p className="text-xs text-chrome">{copy.feeDisclosure(m.creatorFeeBps, m.protocolFeeBps, m.scoutFeeBps)}</p>
                <Link href="/join" className="mt-auto block rounded bg-lime px-4 py-3 text-center font-bold uppercase tracking-wide text-ink shadow-[0_0_20px_rgba(201,247,58,0.3)] transition hover:brightness-110">
                  Join to back
                </Link>
              </div>
            )}
            {holding && holding.amountUnits > 0 ? (
              <form action={sellAction} className="mt-4 border-t border-edge pt-4">
                <input type="hidden" name="handle" value={handle} />
                <input type="hidden" name="marketId" value={m.id} />
                <p className="text-sm text-muted">
                  You hold <span className="stat text-chalk">{num(holding.amountUnits)}</span> units
                  {holding.backerRank ? (
                    <>
                      {" "}
                      · Backer <span className="stat text-gold">#{holding.backerRank}</span>
                    </>
                  ) : null}
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    name="units"
                    type="number"
                    min={1}
                    max={holding.amountUnits}
                    placeholder="Units"
                    required
                    className="w-28 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-pink focus:outline-none"
                  />
                  <SubmitButton pendingLabel="Selling…" className="rounded border border-pink/60 px-4 py-2 text-sm font-bold uppercase tracking-wide text-pink hover:bg-pink/10">
                    Sell to curve
                  </SubmitButton>
                </div>
              </form>
            ) : null}
          </section>
        ) : null}

        {/* Genesis Pass */}
        {creator.status === "LIVE" ? (
          <section className="card flex flex-col p-6">
            <SectionTitle>{copy.cta.becomeGenesisBacker}</SectionTitle>
            {pass ? (
              <p className="rounded border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
                Genesis Backer #{pass.backerNumber} — permanent Day One status.
              </p>
            ) : user ? (
              <form action={passAction} className="flex flex-1 flex-col gap-3">
                <input type="hidden" name="handle" value={handle} />
                <input type="hidden" name="creatorId" value={creator.id} />
                <div className="flex flex-wrap gap-2">
                  {[
                    { cents: 2500, label: "Starter Backer" },
                    { cents: 10000, label: "Genesis Backer" },
                    { cents: 50000, label: "Superfan" },
                  ].map((tier, i) => (
                    <label key={tier.cents} className="cursor-pointer">
                      <input type="radio" name="tier" value={tier.cents} defaultChecked={i === 1} className="peer sr-only" />
                      <span className="inline-block rounded border border-edge px-3 py-2 text-center text-xs font-bold uppercase peer-checked:border-gold peer-checked:text-gold">
                        {money(tier.cents)}
                        <br />
                        {tier.label}
                      </span>
                    </label>
                  ))}
                </div>
                {perks.length ? (
                  <ul className="spark-list text-xs text-muted">
                    {perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-auto">
                  <RiskDisclosure confirmLabel="Secure Genesis Pass" />
                </div>
              </form>
            ) : (
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { cents: 2500, label: "Starter Backer" },
                    { cents: 10000, label: "Genesis Backer" },
                    { cents: 50000, label: "Superfan" },
                  ].map((tier) => (
                    <span key={tier.cents} className="inline-block rounded border border-edge px-3 py-2 text-center text-xs font-bold uppercase text-muted">
                      {money(tier.cents)}
                      <br />
                      {tier.label}
                    </span>
                  ))}
                </div>
                {perks.length ? (
                  <ul className="spark-list text-xs text-muted">
                    {perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                ) : null}
                <Link href="/join" className="mt-auto block rounded bg-gold px-4 py-3 text-center font-bold uppercase tracking-wide text-ink transition hover:brightness-110">
                  Join to become a Genesis Backer
                </Link>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {/* Calls: the internet's number on this creator (points, never cash) */}
      {openCalls.length > 0 ? (
        <section className="mt-6">
          <SectionTitle right={<Link href="/calls" className="text-xs uppercase text-muted hover:text-lime">All calls →</Link>}>
            The internet says
          </SectionTitle>
          <div className={`grid gap-3 ${openCalls.length === 1 ? "" : "md:grid-cols-2"}`}>
            {openCalls.map((call) => (
              <CallCard
                key={call.id}
                call={{ ...call, creator: { handle: creator.handle, displayName: creator.displayName, avatarUrl: creator.avatarUrl } }}
                stakeAction={callStakeAction.bind(null, handle)}
                myStake={myCallStakes.get(call.id)}
                signedIn={Boolean(user)}
                myPoints={user?.points}
                showCreator={false}
              />
            ))}
          </div>
        </section>
      ) : null}

      <MissionSection missions={creator.missions} handle={handle} signedIn={Boolean(user)} />
      {creator.status === "LIVE" ? (
        <>
          <BackstageSection creatorId={creator.id} handle={handle} displayName={creator.displayName} />
          <DropsSection creatorId={creator.id} handle={handle} />
          <StreetTeamSection creatorId={creator.id} handle={handle} />
          <RequestMenuSection creatorId={creator.id} handle={handle} />
          <PaidMessageBox creatorId={creator.id} handle={handle} displayName={creator.displayName} signedIn={Boolean(user)} />
          <TipBox creatorId={creator.id} handle={handle} signedIn={Boolean(user)} />
        </>
      ) : null}

      {/* Market activity + Backer Wall */}
      {overview ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="card p-6">
            <SectionTitle>Live activity</SectionTitle>
            <div className="space-y-1.5 text-sm">
              {overview.transactions.length === 0 ? (
                <p className="text-muted">No trades yet — be the first to back.</p>
              ) : (
                overview.transactions.map((t) => (
                  <p key={t.id} className="feed-in flex justify-between">
                    <span>
                      <span className={t.side === "BUY" ? "text-lime" : "text-pink"}>
                        {t.side === "BUY" ? "▲ backed" : "▼ sold"}
                      </span>{" "}
                      <span className="text-muted">@{t.user.username}</span>
                    </span>
                    <span className="stat text-chrome">
                      {num(t.units)}u · {money(t.grossCents)} · {timeAgo(t.createdAt)}
                    </span>
                  </p>
                ))
              )}
            </div>
          </section>
          <section className="card p-6">
            <SectionTitle>Backer Wall</SectionTitle>
            <p className="mb-2 text-xs text-muted">Permanent proof of being early. First {num(500)} spots.</p>
            <div className="flex flex-wrap gap-2">
              {overview.wall.length === 0 ? (
                <p className="text-sm text-muted">The wall opens at launch.</p>
              ) : (
                overview.wall.map((h) => (
                  <Link
                    key={h.id}
                    href={`/u/${h.user.username}`}
                    className="flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/5 py-1 pl-1 pr-2 transition hover:border-gold"
                    title={`Backer #${h.backerRank}`}
                  >
                    <Monogram name={h.user.username} src={h.user.avatarUrl} size="sm" className="!h-6 !w-6 rounded !text-[10px]" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
                      #{h.backerRank} @{h.user.username}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

      {/* Whale layer: status is the product — tiers are public */}
      {topSupporters.length > 0 ? (
        <section className="card mt-6 p-6">
          <SectionTitle>Top supporters</SectionTitle>
          <p className="mb-3 text-xs text-muted">
            The people putting the most behind {creator.displayName} — passes, missions, drops and
            tips.
          </p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {topSupporters.map((s) => (
              <li key={s.user.id}>
                <Link
                  href={`/u/${s.user.username}`}
                  className="flex items-center gap-3 rounded border border-edge p-2.5 transition hover:border-gold"
                >
                  <span className={`stat w-5 text-right ${s.rank === 1 ? "text-gold" : "text-muted"}`}>#{s.rank}</span>
                  <Monogram name={s.user.username} src={s.user.avatarUrl} size="sm" ring={s.rank === 1 ? "gold" : "none"} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">@{s.user.username}</span>
                  <span
                    className={`chip ${
                      s.tier === "SUPERFAN"
                        ? "bg-gold/15 text-gold border border-gold/50"
                        : s.tier === "VIP"
                          ? "bg-pink/15 text-pink border border-pink/50"
                          : s.tier === "INSIDER"
                            ? "bg-volt/15 text-volt border border-volt/50"
                            : "bg-lime/10 text-lime border border-lime/40"
                    }`}
                  >
                    {s.tier}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {/* div, not p: ReportForm renders a <details> block, invalid inside <p> */}
      <div className="mt-8 text-center text-xs text-muted">
        Something wrong here? <ReportForm objectType="Creator" objectId={creator.id} backTo={`/c/${handle}`} />
      </div>
    </div>
  );
}

