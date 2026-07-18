import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { claim, draft } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { Stat } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, num } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function startClaimAction(formData: FormData) {
  "use server";
  const draftId = String(formData.get("draftId"));
  const user = await currentUser();
  if (!user) redirect(`/join`);
  await withErrorRedirect(`/claim/${draftId}`, async () => {
    await claim.startClaim(user.id, draftId);
  });
  redirect("/dashboard?claimed=1");
}

/** Claim Room (PRD §0A.6 status 2): where a creator claims their draft. */
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ error?: string; scout?: string }>;
}) {
  const { draftId } = await params;
  const { error } = await searchParams;
  const [profile, user] = await Promise.all([
    draft.getDraftProfile(draftId).catch(() => null),
    currentUser(),
  ]);
  if (!profile || profile.takedownStatus === "REMOVED") notFound();

  if (profile.claimStatus === "CLAIMED" && profile.claimedCreator) {
    redirect(`/c/${profile.claimedCreator.handle}`);
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <p className="chip border border-lime/40 bg-lime/10 text-lime">Claim your launch</p>
      <h1 className="display mt-3 text-5xl">{profile.nameOrHandle}</h1>
      <p className="mt-3 text-lg text-chrome">
        You already have <span className="stat font-bold text-lime">{num(profile.fanCount)}</span>{" "}
        fans and{" "}
        <span className="stat font-bold text-lime">
          {money(profile.pledgedDemandTotal, { compact: true })}
        </span>{" "}
        of demand waiting. Claim your FameRace launch.
      </p>

      <div className="card mt-6 grid grid-cols-3 gap-4 p-4">
        <Stat label="Fans waiting" value={num(profile.fanCount)} />
        <Stat label="Pledged demand" value={money(profile.pledgedDemandTotal, { compact: true })} accent="text-lime" />
        <Stat label="Scouts inviting" value={profile.nominations.length} accent="text-volt" />
      </div>

      <div className="card mt-6 p-6">
        <h2 className="display text-2xl">What claiming means</h2>
        <ul className="mt-3 spark-list space-y-1 text-sm text-muted">
          <li>You verify your identity and social accounts — no market goes live without your consent.</li>
          <li>You configure your first mission, perks and payout before anything opens.</li>
          <li>Pledged demand converts only at your official launch, through a fair opening auction.</li>
          <li>You earn from primary sales, Backstage, drops, tips and market fees.</li>
          <li>You can pause or walk away before launch; pledges refund.</li>
        </ul>
        <FormError error={error} />
        {user ? (
          profile.claimStatus === "CLAIM_STARTED" ? (
            <p className="mt-4 rounded border border-chrome/30 bg-chrome/5 px-3 py-2 text-sm text-chrome">
              A claim is already in progress for this profile.{" "}
              <Link href="/dashboard" className="text-lime underline">
                Go to your dashboard
              </Link>{" "}
              if that claim is yours.
            </p>
          ) : (
            <form action={startClaimAction} className="mt-4">
              <input type="hidden" name="draftId" value={draftId} />
              <button className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110">
                This is me — start the claim
              </button>
            </form>
          )
        ) : (
          <Link
            href="/join"
            className="mt-4 block rounded bg-lime px-4 py-3 text-center font-bold uppercase tracking-wide text-ink hover:brightness-110"
          >
            Create an account to claim
          </Link>
        )}
        <p className="mt-3 text-xs text-muted">
          Not you?{" "}
          <Link href={`/draft/${draftId}/takedown`} className="text-pink underline">
            Request removal instead
          </Link>
          . Impersonating a creator is grounds for a permanent ban.
        </p>
      </div>
    </div>
  );
}
