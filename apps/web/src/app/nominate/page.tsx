import { redirect } from "next/navigation";
import { draft } from "@famerace/core";
import { withErrorRedirect } from "@/lib/action";
import { NominateForm } from "@/components/nominate-form";
import { requireCurrentUser } from "@/lib/session";

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

export default async function NominatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-xl py-4">
      <h1 className="display text-4xl">Nominate a rising creator</h1>
      <p className="mb-5 mt-2 text-sm text-muted">
        Found them before the world noticed? Put them on the Draft Board. Nominations are demand
        signals, not endorsements — the creator decides whether to claim.
      </p>
      <NominateForm action={nominateAction} error={params.error} />
    </div>
  );
}
