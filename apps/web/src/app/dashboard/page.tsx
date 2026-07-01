import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claim, copy } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { FuelBar, SectionTitle, Stat, StatusChip } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, num } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
      <FormError error={error} />

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
            <button className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110">
              Submit for verification
            </button>
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
              <button className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110">
                Save perks
              </button>
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
                <button className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110">
                  Activate payouts
                </button>
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
