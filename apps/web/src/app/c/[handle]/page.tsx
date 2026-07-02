import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { copy, market as marketMod } from "@famerace/core";
import { prisma } from "@famerace/db";
import { FormError } from "@/components/form-error";
import { RiskDisclosure, SectionTitle, Stat, StatusChip } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { CATEGORY_LABELS, money, num, timeAgo } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { BackstageSection, DropsSection, MissionSection, TipBox } from "./monetization";
import { StreetTeamSection } from "./street-team";
import { PaidMessageBox, RequestMenuSection } from "./engage";
import { ReportForm } from "@/components/report";
import { ShareRow } from "@/components/share";
import { Backdrop } from "@/components/backdrop";
import { CategoryGlyph } from "@/components/category-art";
import { Confetti } from "@/components/confetti";
import { Monogram } from "@/components/monogram";
import { Countdown } from "@/components/countdown";
import { Sparkline } from "@/components/sparkline";
import { Banner } from "@/components/ui";

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
        missions: { where: { status: { in: ["LIVE", "FUNDED", "IN_PROGRESS", "COMPLETED"] } } },
      },
    }),
    currentUser(),
  ]);
  if (!creator || !["LAUNCHING_SOON", "LIVE", "PAUSED"].includes(creator.status)) notFound();
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
  const perks = Array.isArray(creator.perks) ? (creator.perks as string[]) : [];
  const socials = Array.isArray(creator.socialLinks) ? (creator.socialLinks as string[]) : [];
  const tradeable = m && ["GENESIS_CURVE", "GRADUATION", "MATURE"].includes(m.status);

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {flags.backed || flags.pass ? <Confetti fireKey={flags.backed ? "backed" : "pass"} /> : null}
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
          <div className="mt-6 rounded border border-lime/40 bg-lime/5 p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-muted">Launching in</p>
            <Countdown to={creator.launchAt.toISOString()} className="display mt-1 block text-6xl text-lime" />
            <p className="mt-2 text-sm text-muted">
              Opening auction clears all confirmed demand through one fair fill. No snipers, no empty
              launches — every market opens with a crowd.
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

      {creator.story ? (
        <section className="card mt-6 p-6">
          <SectionTitle>The story</SectionTitle>
          <p className="whitespace-pre-line text-chrome">{creator.story}</p>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Back (buy) — §0B.8 trade sheet */}
        {tradeable && m ? (
          <section className="card p-6">
            <SectionTitle>{copy.cta.back(creator.displayName)}</SectionTitle>
            {user ? (
              <form action={backAction} className="space-y-3">
                <input type="hidden" name="handle" value={handle} />
                <input type="hidden" name="marketId" value={m.id} />
                <div className="flex flex-wrap gap-2">
                  {[2500, 10000, 50000].map((cents, i) => (
                    <label key={cents} className="cursor-pointer">
                      <input type="radio" name="tier" value={cents} defaultChecked={i === 0} className="peer sr-only" />
                      <span className="stat inline-block rounded border border-edge px-4 py-2 text-sm font-bold peer-checked:border-lime peer-checked:text-lime">
                        {money(cents)}
                      </span>
                    </label>
                  ))}
                  <input
                    name="customAmount"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Custom $"
                    className="w-24 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-lime focus:outline-none"
                  />
                </div>
                <ul className="list-inside list-disc text-xs text-muted">
                  <li>${m.ticker} access/status units on the live curve</li>
                  <li>Permanent backer rank on first back</li>
                  <li>Holder-gated Backstage eligibility</li>
                </ul>
                <RiskDisclosure
                  confirmLabel={copy.cta.back(creator.displayName)}
                  feeLine={copy.feeDisclosure(m.creatorFeeBps, m.protocolFeeBps, m.scoutFeeBps)}
                />
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[2500, 10000, 50000].map((cents) => (
                    <span key={cents} className="stat inline-block rounded border border-edge px-4 py-2 text-sm font-bold text-muted">
                      {money(cents)}
                    </span>
                  ))}
                </div>
                <ul className="list-inside list-disc text-xs text-muted">
                  <li>${m.ticker} access/status units on the live curve</li>
                  <li>Permanent backer rank on first back</li>
                  <li>Holder-gated Backstage eligibility</li>
                </ul>
                <p className="text-xs text-chrome">{copy.feeDisclosure(m.creatorFeeBps, m.protocolFeeBps, m.scoutFeeBps)}</p>
                <Link href="/join" className="block rounded bg-lime px-4 py-3 text-center font-bold uppercase tracking-wide text-ink shadow-[0_0_20px_rgba(201,247,58,0.3)] transition hover:brightness-110">
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
                  <button className="rounded border border-pink/60 px-4 py-2 text-sm font-bold uppercase tracking-wide text-pink hover:bg-pink/10">
                    Sell to curve
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        ) : null}

        {/* Genesis Pass */}
        {creator.status === "LIVE" ? (
          <section className="card p-6">
            <SectionTitle>{copy.cta.becomeGenesisBacker}</SectionTitle>
            {pass ? (
              <p className="rounded border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
                Genesis Backer #{pass.backerNumber} — permanent Day One status.
              </p>
            ) : user ? (
              <form action={passAction} className="space-y-3">
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
                  <ul className="list-inside list-disc text-xs text-muted">
                    {perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                ) : null}
                <RiskDisclosure confirmLabel="Secure Genesis Pass" />
              </form>
            ) : (
              <div className="space-y-3">
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
                  <ul className="list-inside list-disc text-xs text-muted">
                    {perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                ) : null}
                <Link href="/join" className="block rounded bg-gold px-4 py-3 text-center font-bold uppercase tracking-wide text-ink transition hover:brightness-110">
                  Join to become a Genesis Backer
                </Link>
              </div>
            )}
          </section>
        ) : null}
      </div>

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
                    <Monogram name={h.user.username} src={h.user.avatarUrl} size="sm" className="!h-6 !w-6 rounded !text-[9px]" />
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
      {/* div, not p: ReportForm renders a <details> block, invalid inside <p> */}
      <div className="mt-8 text-center text-xs text-muted">
        Something wrong here? <ReportForm objectType="Creator" objectId={creator.id} backTo={`/c/${handle}`} />
      </div>
    </div>
  );
}

