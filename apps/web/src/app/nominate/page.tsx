import { redirect } from "next/navigation";
import { draft } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { withErrorRedirect } from "@/lib/action";
import { CATEGORY_LABELS } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

async function nominateAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/join");
  let profileId = "";
  await withErrorRedirect("/nominate", async () => {
    const { profile } = await draft.nominate(user.id, {
      nameOrHandle: String(formData.get("nameOrHandle") ?? ""),
      externalLink: String(formData.get("externalLink") ?? ""),
      category: String(formData.get("category") ?? "") as never,
      thesis: String(formData.get("thesis") ?? ""),
      requestedMission: String(formData.get("requestedMission") ?? ""),
    });
    profileId = profile.id;
  });
  redirect(`/draft/${profileId}`);
}

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-chalk placeholder:text-muted focus:border-volt focus:outline-none";

export default async function NominatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-xl py-4">
      <h1 className="display text-4xl">Nominate a rising creator</h1>
      <p className="mt-2 text-sm text-muted">
        Found them before the world noticed? Put them on the Draft Board. Nominations are demand
        signals, not endorsements — the creator decides whether to claim.
      </p>
      <form action={nominateAction} className="mt-6 space-y-3">
        <FormError error={params.error} />
        <input name="nameOrHandle" placeholder="Name or @handle" required className={inputClass} />
        <input name="externalLink" type="url" placeholder="Link to their public profile (optional)" className={inputClass} />
        <select name="category" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Category
          </option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <textarea
          name="thesis"
          placeholder="Scout thesis — why are they about to break out? (this shows on the profile)"
          required
          minLength={20}
          rows={4}
          className={inputClass}
        />
        <input
          name="requestedMission"
          placeholder="Mission you want to fund (e.g. First Music Video)"
          className={inputClass}
        />
        <SubmitButton
          pendingLabel="Drafting them…"
          className="w-full rounded bg-volt px-4 py-3 font-bold uppercase tracking-wide text-chalk hover:brightness-110"
        >
          Add to the Draft
        </SubmitButton>
        <p className="text-xs text-muted">
          Prohibited: minors, private persons, and anything on the prohibited-categories list.
          Nominations are reviewed before appearing on the public board.
        </p>
      </form>
    </div>
  );
}
