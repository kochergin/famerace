import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { config, copy, demand } from "@famerace/core";
import type { DraftProfile } from "@famerace/db";
import { RiskDisclosure } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

const INTENTS = [
  { value: "GENESIS_PASS", label: "Genesis Pass at launch" },
  { value: "MISSION_PLEDGE", label: "Fund their first mission" },
  { value: "MARKET_BUY", label: "Opening back at launch" },
  { value: "BACKSTAGE", label: "Backstage membership" },
] as const;

async function pledgeAction(formData: FormData) {
  "use server";
  const draftProfileId = String(formData.get("draftProfileId"));
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/join");
  await withErrorRedirect(`/draft/${draftProfileId}`, async () => {
    const custom = Number(formData.get("customAmount") || 0);
    const tier = Number(formData.get("tier") || 0);
    await demand.placeDemandOrder(user.id, {
      draftProfileId,
      intentType: String(formData.get("intentType")) as never,
      amountCents: custom > 0 ? Math.round(custom * 100) : tier,
      binding: true,
    });
  });
  revalidatePath(`/draft/${draftProfileId}`);
  redirect(`/draft/${draftProfileId}?pledged=1`);
}

/**
 * Demand Vault (PRD §0A.3): refundable pledges collected before launch.
 * Money never reaches the creator pre-launch; unclaimed pledges expire.
 */
export function PledgePanel({ profile, signedIn }: { profile: DraftProfile; signedIn: boolean }) {
  return (
    <section className="card mt-6 p-6">
      <h2 className="display text-2xl">{copy.cta.pledgeIfClaimed}</h2>
      <p className="mt-1 text-sm text-muted">
        A refundable pledge that waits in the Demand Vault. It only converts if{" "}
        {profile.nameOrHandle} claims, verifies and launches — otherwise it expires and releases.
        You get a final confirmation window before anything is captured.
      </p>
      {signedIn ? (
        <form action={pledgeAction} className="mt-4 space-y-3">
          <input type="hidden" name="draftProfileId" value={profile.id} />
          <div className="flex flex-wrap gap-2">
            {config.backTiersCents.map((cents, i) => (
              <label key={cents} className="cursor-pointer">
                <input
                  type="radio"
                  name="tier"
                  value={cents}
                  defaultChecked={i === 0}
                  className="peer sr-only"
                />
                <span className="stat inline-block rounded border border-edge px-4 py-2 text-sm font-bold peer-checked:border-lime peer-checked:text-lime">
                  {money(cents)}
                </span>
              </label>
            ))}
            <input
              name="customAmount"
              type="number"
              min={5}
              max={10000}
              step={1}
              placeholder="Custom $"
              className="w-28 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-lime focus:outline-none"
            />
          </div>
          <select
            name="intentType"
            className="w-full rounded border border-edge bg-ink px-3 py-2.5 text-sm text-chalk focus:border-lime focus:outline-none"
            defaultValue="GENESIS_PASS"
          >
            {INTENTS.map((intent) => (
              <option key={intent.value} value={intent.value}>
                {intent.label}
              </option>
            ))}
          </select>
          <RiskDisclosure confirmLabel={copy.cta.pledgeIfClaimed} />
        </form>
      ) : (
        <Link
          href="/join"
          className="mt-4 inline-block rounded bg-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110"
        >
          Join to pledge
        </Link>
      )}
    </section>
  );
}
