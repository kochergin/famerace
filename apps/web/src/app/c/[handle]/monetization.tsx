import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { backstage, copy, drops as dropsMod, missions as missionsMod, media } from "@famerace/core";
import { prisma, type BackstageTier, type Drop, type Mission } from "@famerace/db";
import { LockedMedia } from "@/components/locked-media";
import { FuelBar, RiskDisclosure, SectionCard, SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, num, timeAgo } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

// ── server actions ──

async function fundMissionAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    const custom = Number(formData.get("customAmount") || 0);
    const tier = Number(formData.get("tier") || 0);
    await missionsMod.contribute(
      user.id,
      String(formData.get("missionId")),
      custom > 0 ? Math.round(custom * 100) : tier,
    );
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?funded=1`);
}

async function subscribeAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await backstage.subscribe(user.id, String(formData.get("tierId")));
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?joined=1`);
}

async function buyDropAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await dropsMod.purchaseDrop(user.id, String(formData.get("dropId")));
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?unlocked=1`);
}

async function tipAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await dropsMod.tip(
      user.id,
      String(formData.get("creatorId")),
      Math.round(Number(formData.get("amount") || 0) * 100),
      String(formData.get("message") || "") || undefined,
    );
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?tipped=1`);
}

// ── sections ──

export function MissionSection({
  missions,
  handle,
  signedIn,
}: {
  missions: Mission[];
  handle: string;
  signedIn: boolean;
}) {
  if (missions.length === 0) return null;
  return (
    <SectionCard accent="gold">
      <SectionTitle>Missions</SectionTitle>
      <div className="space-y-5">
        {missions.map((mission) => {
          const pct = Math.min(100, Math.round((mission.fundedCents / mission.goalCents) * 100));
          const open = mission.status === "LIVE" && mission.deadline > new Date();
          return (
            <div key={mission.id} className="rounded border border-edge p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="display text-2xl">{mission.title}</h3>
                <Link href={`/m/${mission.id}`} className="text-xs text-volt underline">
                  Mission page →
                </Link>
              </div>
              <p className="mt-1 text-sm text-muted">{mission.useOfFunds}</p>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="stat text-gold">
                    {money(mission.fundedCents)} / {money(mission.goalCents)}
                  </span>
                  <span className="stat text-muted">{pct}% funded</span>
                </div>
                <FuelBar value={mission.fundedCents} max={mission.goalCents} />
              </div>
              {open ? (
                signedIn ? (
                  <form action={fundMissionAction} className="mt-3 space-y-3">
                    <input type="hidden" name="handle" value={handle} />
                    <input type="hidden" name="missionId" value={mission.id} />
                    <div className="flex flex-wrap gap-2">
                      {[1000, 5000, 10000, 25000].map((cents, i) => (
                        <label key={cents} className="cursor-pointer">
                          <input type="radio" name="tier" value={cents} defaultChecked={i === 1} className="peer sr-only" />
                          <span className="stat inline-block rounded border border-edge px-3 py-1.5 text-sm font-bold peer-checked:border-gold peer-checked:text-gold">
                            {money(cents)}
                          </span>
                        </label>
                      ))}
                      <input
                        name="customAmount"
                        type="number"
                        min={1}
                        placeholder="Custom $"
                        className="w-24 rounded border border-edge bg-ink px-3 py-1.5 text-sm text-chalk placeholder:text-muted focus:border-gold focus:outline-none"
                      />
                    </div>
                    <RiskDisclosure confirmLabel={copy.cta.fundMission} />
                  </form>
                ) : (
                  <Link href="/join" className="mt-3 inline-block rounded bg-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink">
                    Join to fund
                  </Link>
                )
              ) : (
                <p className="mt-2 text-xs uppercase tracking-wide text-gold">{mission.status.replaceAll("_", " ")}</p>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export async function BackstageSection({
  creatorId,
  handle,
  displayName,
}: {
  creatorId: string;
  handle: string;
  displayName: string;
}) {
  const user = await currentUser();
  const [tiers, feed, membership] = await Promise.all([
    prisma.backstageTier.findMany({ where: { creatorId }, orderBy: { priceCents: "asc" } }),
    backstage.feedFor(creatorId, user?.id ?? null),
    user
      ? prisma.backstageMembership.findUnique({
          where: { userId_creatorId: { userId: user.id, creatorId } },
        })
      : null,
  ]);
  if (tiers.length === 0 && feed.length === 0) return null;
  const isMember = membership?.status === "ACTIVE";
  const mimes = await media.mimesForUrls(feed.map(({ post }) => post.mediaUrl).filter(Boolean) as string[]);

  return (
    <SectionCard accent="velvet">
      <SectionTitle right={isMember ? <span className="chip bg-velvet/40 text-chalk">Member</span> : undefined}>
        Backstage
      </SectionTitle>
      {!isMember && tiers.length > 0 ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {tiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} handle={handle} signedIn={Boolean(user)} />
          ))}
        </div>
      ) : null}
      <div className="space-y-3">
        {feed.length === 0 ? (
          <p className="text-sm text-muted">{displayName} has not posted backstage yet.</p>
        ) : (
          feed.map(({ post, unlocked }) => (
            <article key={post.id} className="rounded border border-edge bg-ink/40 p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-bold text-chalk">{post.title}</h3>
                <span className="text-xs text-muted">{timeAgo(post.createdAt)}</span>
              </div>
              {unlocked ? (
                <>
                  <p className="mt-2 whitespace-pre-line text-sm text-chrome">{post.body}</p>
                  {post.mediaUrl ? <LockedMedia src={post.mediaUrl} unlocked label="" mime={mimes.get(post.mediaUrl)} /> : null}
                </>
              ) : (
                <div className="mt-2">
                  {post.preview ? <p className="text-sm text-muted">{post.preview}</p> : null}
                  {post.mediaUrl ? (
                    <LockedMedia
                      src={post.mediaUrl}
                      unlocked={false}
                      label={post.visibility === "HOLDERS" ? "Holders see this" : "Members see this"}
                      mime={mimes.get(post.mediaUrl)}
                    />
                  ) : null}
                  <p className="mt-2 text-xs uppercase tracking-widest text-velvet">
                    🔒 {post.visibility === "HOLDERS" ? "Holders only" : "Members only"}
                  </p>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </SectionCard>
  );
}

function TierCard({ tier, handle, signedIn }: { tier: BackstageTier; handle: string; signedIn: boolean }) {
  const benefits = Array.isArray(tier.benefits) ? (tier.benefits as string[]) : [];
  return (
    <div className="rounded border border-edge p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold uppercase tracking-wide text-chalk">{tier.name}</h3>
        <span className="stat font-bold text-chalk">
          {tier.accessType === "PAID"
            ? `${money(tier.priceCents)}/mo`
            : tier.accessType === "HOLDER_GATED"
              ? `hold ${num(tier.minHoldingUnits)}u`
              : "free"}
        </span>
      </div>
      {benefits.length ? (
        <ul className="mt-2 list-inside list-disc text-xs text-muted">
          {benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      ) : null}
      {signedIn ? (
        <form action={subscribeAction} className="mt-3">
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="tierId" value={tier.id} />
          <SubmitButton pendingLabel="Joining…" className="w-full rounded bg-velvet px-3 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-125">
            {copy.cta.joinBackstage}
          </SubmitButton>
        </form>
      ) : (
        <Link href="/join" className="mt-3 block rounded bg-velvet px-3 py-2 text-center text-sm font-bold uppercase tracking-wide text-chalk">
          Join FameRace first
        </Link>
      )}
    </div>
  );
}

export async function DropsSection({ creatorId, handle }: { creatorId: string; handle: string }) {
  const user = await currentUser();
  const drops = await prisma.drop.findMany({
    where: { creatorId, status: { in: ["LIVE", "SOLD_OUT"] } },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  if (drops.length === 0) return null;
  const dropMimes = await media.mimesForUrls(drops.map((d) => d.mediaUrl).filter(Boolean) as string[]);
  const owned = user
    ? new Set(
        (
          await prisma.dropPurchase.findMany({
            where: { userId: user.id, dropId: { in: drops.map((d) => d.id) } },
            select: { dropId: true },
          })
        ).map((p) => p.dropId),
      )
    : new Set<string>();

  return (
    <SectionCard accent="pink">
      <SectionTitle>Paid drops</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {drops.map((drop) => (
          <DropCard key={drop.id} drop={drop} handle={handle} owned={owned.has(drop.id)} signedIn={Boolean(user)} mime={drop.mediaUrl ? dropMimes.get(drop.mediaUrl) : undefined} />
        ))}
      </div>
    </SectionCard>
  );
}

function DropCard({ drop, handle, owned, signedIn, mime }: { drop: Drop; handle: string; owned: boolean; signedIn: boolean; mime?: string }) {
  return (
    <div className="rounded border border-edge p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold text-chalk">{drop.title}</h3>
        <span className="stat text-sm font-bold text-lime">{money(drop.priceCents)}</span>
      </div>
      {owned ? (
        <>
          <p className="mt-2 whitespace-pre-line text-sm text-chrome">{drop.description}</p>
          {drop.mediaUrl ? <LockedMedia src={drop.mediaUrl} unlocked label="" mime={mime} /> : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">{drop.previewText ?? "Unlock to view."}</p>
          {drop.mediaUrl ? <LockedMedia src={drop.mediaUrl} unlocked={false} label="Unlock to see it sharp" mime={mime} /> : null}
        </>
      )}
      {drop.quantityLimit ? (
        <p className="mt-1 text-xs text-muted">
          {drop.status === "SOLD_OUT" ? "Sold out" : `${drop.quantityLimit - drop.soldCount} of ${drop.quantityLimit} left`}
        </p>
      ) : null}
      {!owned && drop.status === "LIVE" ? (
        signedIn ? (
          <form action={buyDropAction} className="mt-3">
            <input type="hidden" name="handle" value={handle} />
            <input type="hidden" name="dropId" value={drop.id} />
            <SubmitButton pendingLabel="Funding…" className="w-full rounded bg-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110">
              Unlock
            </SubmitButton>
          </form>
        ) : (
          <Link href="/join" className="mt-3 block rounded border border-edge px-3 py-2 text-center text-sm font-bold uppercase text-muted">
            Join to unlock
          </Link>
        )
      ) : null}
    </div>
  );
}

export function TipBox({ creatorId, handle, signedIn }: { creatorId: string; handle: string; signedIn: boolean }) {
  if (!signedIn) return null;
  return (
    <SectionCard accent="pink">
      <SectionTitle>Send a boost</SectionTitle>
      <form action={tipAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="creatorId" value={creatorId} />
        <input
          name="amount"
          type="number"
          min={1}
          placeholder="$"
          required
          className="w-24 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-pink focus:outline-none"
        />
        <input
          name="message"
          placeholder="Say something (optional)"
          maxLength={200}
          className="min-w-40 flex-1 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-pink focus:outline-none"
        />
        <SubmitButton pendingLabel="Unlocking…" className="rounded bg-pink px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110">
          Tip
        </SubmitButton>
      </form>
      <p className="mt-2 text-xs text-muted">90% goes to the creator.</p>
    </SectionCard>
  );
}
