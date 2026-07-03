import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { advance as advanceMod, battles as battlesMod, claim, copy } from "@famerace/core";
import { prisma } from "@famerace/db";
import { AvatarUpload } from "@/components/avatar-upload";
import { Arena, nextRoom } from "@/components/arena";
import { ClaimCeremony } from "@/components/claim-ceremony";
import { FirstDollar } from "@/components/first-dollar";
import { WeekOne, weekComplete, type WeekStep } from "@/components/week-one";
import { FormError } from "@/components/form-error";
import { Monogram } from "@/components/monogram";
import { FuelBar, SectionTitle, Stat, StatusChip } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, num } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

async function advanceAction() {
  "use server";
  const user = await requireCurrentUser();
  let cents = 0;
  await withErrorRedirect("/dashboard", async () => {
    const row = await advanceMod.takeAdvance(user.id);
    cents = row.amountCents;
  });
  revalidatePath("/dashboard");
  redirect(`/dashboard?advanced=${cents}`);
}

async function unlockAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect("/dashboard", async () => {
    await battlesMod.setUnlock(
      user.id,
      Math.round(Number(formData.get("atSeats") || 0)),
      String(formData.get("title") ?? ""),
    );
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

async function verifyAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  const creatorId = String(formData.get("creatorId"));
  await withErrorRedirect("/dashboard", async () => {
    const links = String(formData.get("socialLinks") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    await claim.submitVerification(user.id, creatorId, {
      bio: String(formData.get("bio") ?? ""),
      story: String(formData.get("story") ?? ""),
      socialLinks: links,
      followerCount: Math.max(0, Math.round(Number(formData.get("followerCount") || 0))),
      termsAccepted: formData.get("termsAccepted") === "on" ? true : (false as never),
    });
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

async function perksAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  const creatorId = String(formData.get("creatorId"));
  await withErrorRedirect("/dashboard", async () => {
    const perks = String(formData.get("perks") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    await claim.configurePerks(user.id, creatorId, { perks });
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

async function payoutAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  const creatorId = String(formData.get("creatorId"));
  await withErrorRedirect("/dashboard", async () => {
    await claim.configurePayout(user.id, creatorId);
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${done ? "text-lime" : "text-muted"}`}>
      <span className="stat">{done ? "✓" : "○"}</span>
      {children}
    </li>
  );
}

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-sm text-chalk placeholder:text-muted focus:border-lime focus:outline-none";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; claimed?: string; advanced?: string }>;
}) {
  const { error, claimed, advanced } = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const creator = await claim.creatorForUser(user.id);

  if (!creator) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <h1 className="display text-4xl">No creator profile yet</h1>
        <p className="mt-3 text-muted">
          Find yourself on the Draft Board and claim your launch, or get nominated by a scout first.
        </p>
        <Link
          href="/draft"
          className="mt-6 inline-block rounded bg-volt px-6 py-3 font-bold uppercase tracking-wide text-chalk hover:brightness-110"
        >
          Open the Draft Board
        </Link>
      </div>
    );
  }

  const t = creator.launchThreshold;
  const perksCount = Array.isArray(creator.perks) ? creator.perks.length : 0;
  const missionReady = creator.missions.some((m) => m.status === "UNDER_REVIEW" || m.status === "LIVE");

  const [advState, passes, tips, dropBuys, contribs, lastPost, memberCount] = await Promise.all([
    advanceMod.advanceStatus(creator.id),
    prisma.genesisPass.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { username: true, avatarUrl: true } } },
    }),
    prisma.tip.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { fromUser: { select: { username: true, avatarUrl: true } } },
    }),
    prisma.dropPurchase.findMany({
      where: { drop: { creatorId: creator.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { username: true, avatarUrl: true } }, drop: { select: { title: true } } },
    }),
    prisma.missionContribution.findMany({
      where: { mission: { creatorId: creator.id }, refunded: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { username: true, avatarUrl: true } }, mission: { select: { title: true } } },
    }),
    prisma.backstagePost.findFirst({
      where: { creatorId: creator.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.backstageMembership.count({ where: { creatorId: creator.id, status: "ACTIVE" } }),
  ]);

  // Arena: every distinct supporter lights one seat (holders + pass holders).
  const [holderIds, passIds, earnedAgg] = await Promise.all([
    creator.market
      ? prisma.holding.findMany({
          where: { creatorMarketId: creator.market.id, amountUnits: { gt: 0 } },
          select: { userId: true },
        })
      : Promise.resolve([] as { userId: string }[]),
    prisma.genesisPass.findMany({ where: { creatorId: creator.id }, select: { userId: true } }),
    prisma.ledgerEntry.aggregate({
      where: { account: "CREATOR_EARNED", creatorId: creator.id, deltaCents: { gt: 0 } },
      _sum: { deltaCents: true },
    }),
  ]);
  const seatCount = new Set([...holderIds, ...passIds].map((r) => r.userId)).size;
  const [unlocks, dropsCount, tiersCount] = await Promise.all([
    battlesMod.unlocksFor(creator.id),
    prisma.drop.count({ where: { creatorId: creator.id, status: { in: ["LIVE", "SOLD_OUT"] } } }),
    prisma.backstageTier.count({ where: { creatorId: creator.id } }),
  ]);
  const lifetimeEarnedCents = earnedAgg._sum.deltaCents ?? 0;

  // First-dollar ceremony: fires exactly once — the notification row is the flag.
  let firstDollar = false;
  if (lifetimeEarnedCents > 0) {
    const seen = await prisma.notification.findFirst({
      where: { userId: user.id, type: "PAYOUT_UPDATE", title: "First money on FameRace" },
      select: { id: true },
    });
    if (!seen) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "PAYOUT_UPDATE",
          title: "First money on FameRace",
          body: "Someone paid to believe in you. It compounds from here.",
          link: "/dashboard/earnings",
          readAt: new Date(),
        },
      });
      firstDollar = true;
    }
  }

  const race = [
    ...passes.map((x) => ({ at: x.createdAt, user: x.user, label: `Genesis Pass · #${x.backerNumber}`, cents: x.tierCents })),
    ...tips.map((x) => ({ at: x.createdAt, user: x.fromUser, label: "Tip", cents: x.amountCents })),
    ...dropBuys.map((x) => ({ at: x.createdAt, user: x.user, label: `Drop · ${x.drop.title}`, cents: x.priceCents })),
    ...contribs.map((x) => ({ at: x.createdAt, user: x.user, label: `Mission · ${x.mission.title}`, cents: x.amountCents })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  const staleDays = lastPost ? Math.floor((Date.now() - lastPost.createdAt.getTime()) / 86_400_000) : 99;
  const nextMove = !creator.avatarUrl
    ? { text: "Upload your face — pages with a face convert visitors into backers.", href: "#face", cta: "Upload above ↑" }
    : staleDays >= 3 && memberCount > 0
      ? { text: `${num(memberCount)} Backstage members have not heard from you in ${staleDays === 99 ? "a while" : `${staleDays} days`}.`, href: "/dashboard/backstage", cta: "Post now →" }
      : { text: "Your numbers are proof. Post the income card where your people are.", href: `/card/creator_revenue/${creator.handle}`, cta: "Get the card ↓" };

  const week: WeekStep[] = [
    { label: "Show your face", done: Boolean(creator.avatarUrl), hint: "Upload below — faces convert." },
    { label: "Pass verification", done: creator.status !== "CLAIM_STARTED", hint: "The form is right below." },
    { label: "Promise an unlock", done: unlocks.length > 0, hint: "Give the crowd a goal — arena card." },
    { label: "Post backstage", done: Boolean(lastPost), hint: "One demo from your drafts folder." },
    { label: "Turn money on", done: Boolean(advState.taken) || lifetimeEarnedCents > 0, hint: "Take the advance or land the first sale." },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="display text-4xl">{creator.displayName}</h1>
          <p className="mt-1 text-sm text-muted">
            Creator dashboard{creator.market ? ` · $${creator.market.ticker}` : ""}
          </p>
        </div>
        <StatusChip status={creator.status} />
      </div>
      {claimed ? (
        <ClaimCeremony
          name={creator.displayName}
          fans={creator.draftProfile?.fanCount ?? 0}
          pledgedLabel={money(creator.draftProfile?.pledgedDemandTotal ?? 0, { compact: true })}
          draftId={creator.draftProfileId}
          handle={creator.handle}
        />
      ) : null}
      {firstDollar && !claimed ? (
        <FirstDollar amountLabel={money(lifetimeEarnedCents, { compact: true })} backers={seatCount} />
      ) : null}
      <FormError error={error} />

      {advanced ? (
        <div className="card spotlight story-in mt-4 border-lime/40 p-5" style={{ "--spot": "rgb(201 247 58 / 0.16)" } as React.CSSProperties}>
          <p className="stat text-[10px] uppercase tracking-[0.3em] text-muted">Season advance · sent</p>
          <p className="display mt-1 text-3xl">
            <span className="text-lime">{money(Number(advanced))}</span> just landed in your wallet.
          </p>
          <p className="mt-1 text-xs text-muted">
            Repays itself out of future earnings — nothing to do. Now go give them a show.
          </p>
        </div>
      ) : null}

      {/* The headline moment: money against demand that already believes in you */}
      {advState.eligibleCents > 0 ? (
        <div className="card spotlight mt-4 border-lime/50 p-6" style={{ "--spot": "rgb(201 247 58 / 0.18)" } as React.CSSProperties}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="stat text-[10px] uppercase tracking-[0.3em] text-muted">Season advance · yours today</p>
              <p className="display mt-1 text-5xl text-lime">{money(advState.eligibleCents)}</p>
              <p className="mt-1 max-w-sm text-xs text-muted">
                An instant advance against the {money(advState.demandCents, { compact: true })} your fans
                already pledged. Repaid automatically from future earnings. No forms, no waiting.
              </p>
            </div>
            <form action={advanceAction}>
              <SubmitButton
                pendingLabel="Sending to your wallet…"
                className="rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.35)] hover:brightness-110"
              >
                Get paid today →
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : advState.taken ? (
        <p className="chip mt-4 border border-edge text-muted">
          Season advance {money(advState.taken.amountCents)} · repaid {money(advState.taken.repaidCents)}
        </p>
      ) : null}

      {/* The arena: your people as lit seats — sell out the next room */}
      {creator.status === "LIVE" || seatCount > 0 ? (
        <section className="card spotlight mt-4 p-5" style={{ "--spot": "rgb(201 247 58 / 0.1)" } as React.CSSProperties}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle
              right={
                <a href={`/card/momentum/${creator.handle}/png`} target="_blank" className="text-xs uppercase text-muted hover:text-lime">
                  Momentum report ↓
                </a>
              }
            >
              Your arena
            </SectionTitle>
            <p className="stat text-xs text-muted">
              <span className="font-bold text-lime">{num(seatCount)}</span> {seatCount === 1 ? "seat" : "seats"} lit
              {nextRoom(seatCount) ? (
                <>
                  {" "}· next room: <span className="font-bold text-gold">{nextRoom(seatCount)!.label}</span> at {nextRoom(seatCount)!.at}
                </>
              ) : (
                <> · sold out — you filled the arena</>
              )}
            </p>
          </div>
          <Arena lit={seatCount} className="mx-auto mt-1 w-full max-w-md" />
          {nextRoom(seatCount) ? (
            <FuelBar value={seatCount} max={nextRoom(seatCount)!.at} />
          ) : null}
          <p className="mt-2 text-[11px] text-muted">
            Every new backer moves four numbers at once: your advance ceiling, this room, the battle
            bar and your momentum report.
          </p>
          {/* Collective unlocks: give the crowd a named goal — they'll do the inviting */}
          <div className="mt-4 border-t border-edge pt-3">
            {unlocks.length > 0 ? (
              <ul className="mb-3 space-y-1 text-sm">
                {unlocks.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2">
                    <span className={u.unlocked ? "text-muted line-through" : "text-chalk"}>
                      {u.unlocked ? "🔓" : "🔒"} {u.title}
                    </span>
                    <span className="stat shrink-0 text-xs text-muted">at {num(u.atSeats)} seats</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <form action={unlockAction} className="flex flex-wrap items-center gap-2">
              <input
                name="title"
                placeholder="At the next room I'll unlock… (e.g. unreleased demo)"
                required
                className="min-w-0 flex-1 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-lime focus:outline-none"
              />
              <input
                name="atSeats"
                type="number"
                min={1}
                defaultValue={nextRoom(seatCount)?.at ?? 10}
                required
                className="w-20 rounded border border-edge bg-ink px-2.5 py-2 text-sm text-chalk focus:border-lime focus:outline-none"
                title="Seats"
              />
              <SubmitButton pendingLabel="Promising…" className="rounded bg-gold px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink hover:brightness-110">
                Promise it
              </SubmitButton>
            </form>
            <p className="mt-1.5 text-[11px] text-muted">
              The promise shows on your public page — your crowd does the inviting to unlock it.
            </p>
          </div>
        </section>
      ) : null}

      {/* The money map: every stream, on or off, and the switch for each */}
      {lifetimeEarnedCents < 5_000 ? (
        <section className="card mt-4 p-5">
          <SectionTitle>Your money map</SectionTitle>
          <ul className="space-y-2 text-sm">
            {[
              {
                on: Boolean(advState.taken),
                name: "Season advance",
                state: advState.taken
                  ? `${money(advState.taken.amountCents)} taken`
                  : advState.eligibleCents > 0
                    ? `${money(advState.eligibleCents)} ready — take it above`
                    : `unlocks at $250 of pledged demand (${money(advState.demandCents, { compact: true })} now)`,
              },
              {
                on: Boolean(creator.market),
                name: "Trading fees",
                state: creator.market ? "on — you earn a cut of every trade on your name" : "turns on at launch, automatically",
              },
              {
                on: passes.length > 0,
                name: "Genesis passes",
                state: passes.length > 0 ? "selling — day-one status, capped forever" : "live on your page — share it",
              },
              {
                on: tiersCount > 0,
                name: "Backstage",
                state: tiersCount > 0 ? `${num(memberCount)} member${memberCount === 1 ? "" : "s"}` : "set one tier in the Backstage tab",
              },
              {
                on: dropsCount > 0,
                name: "Drops",
                state: dropsCount > 0 ? `${num(dropsCount)} live` : "one demo, one price — Backstage tab",
              },
              {
                on: creator.missions.length > 0,
                name: "Missions",
                state: creator.missions.length > 0 ? `${num(creator.missions.length)} running` : "pitch one in the Missions tab",
              },
            ].map((stream) => (
              <li key={stream.name} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${stream.on ? "bg-lime shadow-[0_0_6px_rgba(201,247,58,0.8)]" : "bg-edge"}`}
                />
                <span className="w-32 shrink-0 font-bold text-chalk">{stream.name}</span>
                <span className={`min-w-0 truncate ${stream.on ? "text-lime" : "text-muted"}`}>{stream.state}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* First week = a track to cross; after that, one next move at a time */}
      {!weekComplete(week) ? <WeekOne steps={week} /> : null}
      {weekComplete(week) ? (
      <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 border-volt/40 p-4">
        <p className="text-sm text-chalk">
          <span className="stat mr-2 text-[10px] uppercase tracking-[0.25em] text-volt">Next move</span>
          {nextMove.text}
        </p>
        <a href={nextMove.href} target={nextMove.href.startsWith("/card") ? "_blank" : undefined} className="shrink-0 rounded border border-volt px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-volt hover:bg-volt/10">
          {nextMove.cta}
        </a>
      </div>
      ) : null}

      {/* The race: your people, with faces */}
      {race.length > 0 ? (
        <section className="card mt-4 p-5">
          <SectionTitle>Your race right now</SectionTitle>
          <ul className="space-y-2">
            {race.map((event, index) => (
              <li key={index} className="feed-in flex items-center gap-3 text-sm">
                <Monogram name={event.user.username} src={event.user.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-chalk">@{event.user.username}</span>{" "}
                  <span className="text-muted">· {event.label}</span>
                </span>
                <span className="stat font-bold text-lime">+{money(event.cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="card mt-4 p-5" id="face">
        <AvatarUpload
          target="creator"
          name={creator.displayName}
          currentUrl={creator.avatarUrl}
          label="Your public face — shown on your page, the boards and the FameRace 100"
        />
      </div>

      {creator.draftProfile ? (
        <div className="card mt-4 grid grid-cols-3 gap-4 p-4">
          <Stat label="Fans waiting" value={num(creator.draftProfile.fanCount)} />
          <Stat
            label="Pledged demand"
            value={money(creator.draftProfile.pledgedDemandTotal, { compact: true })}
            accent="text-lime"
          />
          <Stat
            label="Confirmed demand"
            value={t ? money(t.confirmedDemandCents, { compact: true }) : "—"}
            accent="text-volt"
          />
        </div>
      ) : null}

      {/* Launch checklist (PRD §8.4 creator dashboard, §0A.5 gate) */}
      <section className="card mt-6 p-6">
        <SectionTitle>Launch checklist</SectionTitle>
        <ul className="space-y-2">
          <Check done={creator.verificationStatus === "VERIFIED"}>
            Identity &amp; social verification
            {creator.verificationStatus === "PENDING" ? " — under review" : ""}
          </Check>
          <Check done={perksCount >= 3}>Backer perks configured ({perksCount}/3)</Check>
          <Check done={creator.payoutStatus === "ACTIVE"}>Payout setup</Check>
          <Check done={missionReady}>First mission configured</Check>
          <Check done={creator.launchKitApproved}>Launch kit approved</Check>
          <Check done={creator.safetyApproved}>Trust &amp; safety review</Check>
          {t ? (
            <>
              <Check done={t.confirmedBackers >= t.requiredBackers}>
                {num(t.confirmedBackers)}/{num(t.requiredBackers)} confirmed backers
              </Check>
              <Check done={t.confirmedDemandCents >= t.requiredDemandCents}>
                {money(t.confirmedDemandCents)}/{money(t.requiredDemandCents)} confirmed demand
              </Check>
            </>
          ) : null}
        </ul>
        {t ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Threshold: {t.status.replaceAll("_", " ")}</span>
              <span>
                {money(t.confirmedDemandCents, { compact: true })} /{" "}
                {money(t.requiredDemandCents, { compact: true })}
              </span>
            </div>
            <FuelBar value={t.confirmedDemandCents} max={t.requiredDemandCents} />
          </div>
        ) : null}
      </section>

      {creator.status === "CLAIM_STARTED" ? (
        <section className="card mt-6 p-6">
          <SectionTitle>Verify your identity</SectionTitle>
          <form action={verifyAction} className="space-y-3">
            <input type="hidden" name="creatorId" value={creator.id} />
            <textarea name="bio" placeholder="Short bio (shows on your card)" required minLength={10} rows={2} className={inputClass} />
            <textarea
              name="story"
              placeholder="Your story — who you are, why you're rising, what backers make possible"
              required
              minLength={20}
              rows={4}
              className={inputClass}
            />
            <textarea
              name="socialLinks"
              placeholder={"Social profile links, one per line\nhttps://tiktok.com/@you"}
              required
              rows={3}
              className={inputClass}
            />
            <input
              name="followerCount"
              type="number"
              min={0}
              placeholder="Total followers across platforms (we check it against your links)"
              className={inputClass}
            />
            <label className="flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" name="termsAccepted" required className="mt-0.5 accent-lime" />
              {copy.creatorTermsSummary}
            </label>
            <SubmitButton pendingLabel="Working…" className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110">
              Submit for verification
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {creator.verificationStatus === "VERIFIED" ? (
        <>
          <section className="card mt-6 p-6">
            <SectionTitle>Backer perks</SectionTitle>
            <form action={perksAction} className="space-y-3">
              <input type="hidden" name="creatorId" value={creator.id} />
              <textarea
                name="perks"
                placeholder={"One perk per line (minimum 3)\nEarly access to every drop\nMonthly backstage Q&A\nGenesis wall shoutout"}
                rows={4}
                required
                defaultValue={Array.isArray(creator.perks) ? (creator.perks as string[]).join("\n") : ""}
                className={inputClass}
              />
              <SubmitButton pendingLabel="Working…" className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110">
                Save perks
              </SubmitButton>
            </form>
          </section>

          {creator.payoutStatus !== "ACTIVE" ? (
            <section className="card mt-6 p-6">
              <SectionTitle>Payout setup</SectionTitle>
              <p className="text-sm text-muted">
                Connect where your earnings go. The dev rail activates instantly; production uses a
                verified payment provider.
              </p>
              <form action={payoutAction} className="mt-3">
                <input type="hidden" name="creatorId" value={creator.id} />
                <SubmitButton pendingLabel="Working…" className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110">
                  Activate payouts
                </SubmitButton>
              </form>
            </section>
          ) : null}

          <section className="card mt-6 p-6">
            <SectionTitle>First mission</SectionTitle>
            {missionReady ? (
              <p className="text-sm text-lime">Mission configured ✓</p>
            ) : (
              <p className="text-sm text-muted">
                Your launch gate needs a first mission —{" "}
                <Link href="/dashboard/missions" className="text-gold underline">
                  open the mission builder
                </Link>
                .
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
