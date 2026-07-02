import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copy, draft, DomainError } from "@famerace/core";
import { SectionTitle, Stat } from "@/components/ui";
import { CATEGORY_LABELS, money, num, timeAgo } from "@/lib/format";
import { currentUser, requireCurrentUser } from "@/lib/session";
import { PledgePanel } from "./pledge-panel";
import { Backdrop } from "@/components/backdrop";
import { ClaimKit } from "@/components/claim-kit";
import { Confetti } from "@/components/confetti";
import { Monogram } from "@/components/monogram";
import { ShareRow } from "@/components/share";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await draft.getDraftProfile(id).catch(() => null);
  if (!profile) return {};
  const image = `/card/draft_rank/${id}/png`;
  return {
    title: `${profile.nameOrHandle} — FameRace Draft`,
    description: "The internet is drafting 100 future stars. Back the rise.",
    openGraph: { images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

async function watchAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser().catch(() => null);
  const id = String(formData.get("id"));
  if (!user) redirect(`/join`);
  await draft.watchDraft(user.id, id);
  revalidatePath(`/draft/${id}`);
}

async function inviteAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser().catch(() => null);
  const id = String(formData.get("id"));
  if (!user) redirect(`/join`);
  await draft.recordInvite(user.id, id);
  revalidatePath(`/draft/${id}`);
  redirect(`/draft/${id}?invited=1`);
}

/** Silent invite credit when a fan fires the claim-campaign kit. */
async function recordInviteQuiet(id: string) {
  "use server";
  const user = await currentUser();
  if (!user) return;
  await draft.recordInvite(user.id, id).catch(() => {});
}

export default async function DraftProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invited?: string; error?: string; pledged?: string }>;
}) {
  const { id } = await params;
  const { invited, error, pledged } = await searchParams;
  const [profile, user] = await Promise.all([
    draft.getDraftProfile(id).catch((e) => {
      if (e instanceof DomainError) return null;
      throw e;
    }),
    currentUser(),
  ]);
  if (!profile || profile.moderationStatus === "REJECTED" || profile.takedownStatus === "REMOVED") {
    notFound();
  }

  const isPending = profile.moderationStatus === "PENDING";
  const claimed = profile.claimStatus === "CLAIMED" && profile.claimedCreator;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: profile.nameOrHandle,
      description: profile.reasonNominated ?? undefined,
      url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://famerace.fun"}/draft/${profile.id}`,
      ...(profile.externalLink ? { sameAs: [profile.externalLink] } : {}),
    },
  };

  return (
    <div className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {isPending ? (
        <p className="mb-4 rounded border border-chrome/30 bg-chrome/5 px-3 py-2 text-sm text-chrome">
          This nomination is awaiting moderation review — it is not on the public board yet.
        </p>
      ) : null}
      {invited ? (
        <p className="mb-4 rounded border border-lime/30 bg-lime/5 px-3 py-2 text-sm text-lime">
          Invite recorded. Now send them the claim link — you are on the scout wall.
        </p>
      ) : null}
      {pledged ? (
        <>
          <Confetti fireKey="pledged" />
          <div className="card spotlight story-in mb-4 border-lime/40 p-5" style={{ "--spot": "rgb(201 247 58 / 0.16)" } as React.CSSProperties}>
            <p className="stat text-[10px] uppercase tracking-[0.3em] text-muted">Called it · receipt</p>
            <p className="display mt-1 text-3xl">
              You called <span className="text-lime">{profile.nameOrHandle}</span> early.
            </p>
            <p className="mt-1 text-xs text-muted">
              Demand order placed — you get a confirmation window before anything becomes binding.
            </p>
            <div className="mt-3">
              <ShareRow
                text={`I just called ${profile.nameOrHandle} on the FameRace Draft — ${num(profile.fanCount)} fans waiting. Receipt says early. #BackTheRise`}
                path={`/draft/${profile.id}`}
                cardPath={`/card/draft_rank/${profile.id}/png`}
              />
            </div>
          </div>
        </>
      ) : null}
      {error ? (
        <p className="mb-4 rounded border border-pink/40 bg-pink/10 px-3 py-2 text-sm text-pink">{error}</p>
      ) : null}

      <div className="card relative isolate overflow-hidden p-6">
        <Backdrop name={profile.nameOrHandle} />
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Monogram name={profile.nameOrHandle} size="lg" ring="draft" morph={`draft-${profile.id}`} className="mt-1" />
            <div>
            <p className="stat text-sm text-muted">DRAFT PROFILE</p>
            <h1 className="display mt-1 text-5xl">{profile.nameOrHandle}</h1>
            <p className="mt-1 text-muted">
              {CATEGORY_LABELS[profile.category]} · nominated by fans
              {profile.externalLink ? (
                <>
                  {" · "}
                  <a href={profile.externalLink} rel="noreferrer nofollow" target="_blank" className="text-volt underline">
                    public profile ↗
                  </a>
                </>
              ) : null}
            </p>
            </div>
          </div>
          {claimed ? (
            <Link href={`/c/${profile.claimedCreator!.handle}`} className="chip bg-lime text-ink">
              Live → view creator
            </Link>
          ) : (
            <span className="stamp border-volt text-volt">Unclaimed</span>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-edge pt-4 sm:grid-cols-4">
          <Stat label="Fans waiting" value={num(profile.fanCount)} />
          <Stat label="Pledged demand" value={money(profile.pledgedDemandTotal, { compact: true })} accent="text-lime" />
          <Stat label="Scouts inviting" value={profile.nominations.length} accent="text-volt" />
          <Stat label="Invites sent" value={num(profile.inviteCount)} />
        </div>

        {profile.requestedMission ? (
          <p className="mt-4 text-sm text-muted">
            Top requested mission: <span className="font-semibold text-gold">{profile.requestedMission}</span>
          </p>
        ) : null}

        <p className="mt-4 rounded border border-edge bg-ink/50 p-3 text-xs text-muted">{copy.draftNotice}</p>

        <div className="mt-4">
          <ShareRow
            text={`${profile.nameOrHandle} is on the FameRace Draft — ${profile.fanCount} fans waiting. Find them early.`}
            path={`/draft/${profile.id}`}
            cardPath={`/card/draft_rank/${profile.id}/png`}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <form action={inviteAction}>
            <input type="hidden" name="id" value={profile.id} />
            <SubmitButton pendingLabel="Recording…" className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110">
              {copy.cta.invite(profile.nameOrHandle)}
            </SubmitButton>
          </form>
          <form action={watchAction}>
            <input type="hidden" name="id" value={profile.id} />
            <SubmitButton pendingLabel="Adding…" className="rounded border border-edge px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:border-lime">
              {copy.cta.addToRoster}
            </SubmitButton>
          </form>
          {!claimed ? (
            <Link
              href={`/claim/${profile.id}`}
              className="rounded border border-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-lime hover:bg-lime/10"
            >
              This is me — claim
            </Link>
          ) : null}
        </div>
      </div>

      {!claimed ? <PledgePanel profile={profile} signedIn={Boolean(user)} /> : null}

      {/* Claim campaign kit — fans pressure the claim; time-to-claim is the metric */}
      {!claimed ? (
        <section className="card mt-6 border-volt/40 p-5">
          <SectionTitle>Get {profile.nameOrHandle} to claim</SectionTitle>
          <p className="mb-3 text-xs text-muted">
            The pot only unlocks when they claim. Send them the message — every send counts as an
            invite on the scout wall.
          </p>
          <ClaimKit
            message={copy.claimCampaign(
              profile.nameOrHandle,
              profile.fanCount,
              money(profile.pledgedDemandTotal, { compact: true }),
            )}
            claimPath={`/claim/${profile.id}${user ? `?scout=${user.referralCode}` : ""}`}
            onSend={recordInviteQuiet.bind(null, profile.id)}
          />
        </section>
      ) : null}

      <section className="mt-6">
        <SectionTitle>Scout wall</SectionTitle>
        <div className="space-y-2">
          {profile.nominations.map((n) => (
            <div key={n.id} className="card p-3 text-sm">
              <p className="text-chrome">
                <Link href={`/u/${n.scout.username}`} className="font-semibold text-volt">
                  @{n.scout.username}
                </Link>{" "}
                · {timeAgo(n.createdAt)}
              </p>
              <p className="mt-1 text-chalk">{n.thesis}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted">
        Are you {profile.nameOrHandle} and want this removed?{" "}
        <Link href={`/draft/${profile.id}/takedown`} className="text-pink underline">
          Request takedown
        </Link>
      </p>
    </div>
  );
}
