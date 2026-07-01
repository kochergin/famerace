import { redirect } from "next/navigation";
import { draft } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { withErrorRedirect } from "@/lib/action";

async function takedownAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await withErrorRedirect(`/draft/${id}/takedown`, async () => {
    await draft.requestTakedown(id, {
      requesterContact: String(formData.get("requesterContact") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
  });
  redirect(`/draft/${id}/takedown?sent=1`);
}

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-chalk placeholder:text-muted focus:border-pink focus:outline-none";

export default async function TakedownPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { id } = await params;
  const { error, sent } = await searchParams;
  const profile = await draft.getDraftProfile(id);

  if (sent) {
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <h1 className="display text-3xl">Request received</h1>
        <p className="mt-3 text-muted">
          Our trust &amp; safety team will review it and contact you. If impersonation is suspected the
          profile is hidden during review.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-4">
      <h1 className="display text-3xl">Request takedown</h1>
      <p className="mt-2 text-sm text-muted">
        You are asking us to remove the draft profile for{" "}
        <span className="font-semibold text-chalk">{profile.nameOrHandle}</span>. No sign-up needed. We
        prioritize requests from the profile subject.
      </p>
      <form action={takedownAction} className="mt-6 space-y-3">
        <FormError error={error} />
        <input type="hidden" name="id" value={id} />
        <input
          name="requesterContact"
          placeholder="How can we reach you? (email or verified social handle)"
          required
          className={inputClass}
        />
        <textarea
          name="reason"
          placeholder="Tell us who you are and why this should come down"
          required
          minLength={10}
          rows={4}
          className={inputClass}
        />
        <button
          type="submit"
          className="w-full rounded bg-pink px-4 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110"
        >
          Submit takedown request
        </button>
      </form>
    </div>
  );
}
