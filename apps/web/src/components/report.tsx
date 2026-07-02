import { redirect } from "next/navigation";
import { safety } from "@famerace/core";
import { withErrorRedirect } from "@/lib/action";
import { requireCurrentUser } from "@/lib/session";

async function reportAction(formData: FormData) {
  "use server";
  const raw = String(formData.get("backTo"));
  // Same-site paths only — a crafted backTo must never redirect off-site.
  const backTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/join");
  await withErrorRedirect(backTo, async () => {
    await safety.fileReport(user.id, {
      objectType: String(formData.get("objectType")) as never,
      objectId: String(formData.get("objectId")),
      reason: String(formData.get("reason")) as never,
      detail: String(formData.get("detail") ?? ""),
    });
  });
  redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}reported=1`);
}

const REASONS = [
  ["IMPERSONATION", "Impersonation"],
  ["HARASSMENT", "Harassment"],
  ["PROHIBITED_CATEGORY", "Prohibited content"],
  ["FRAUD", "Fraud or scam"],
  ["OTHER", "Something else"],
] as const;

/** Inline report form (PRD §15.9) — collapsed behind a <details> toggle. */
export function ReportForm({
  objectType,
  objectId,
  backTo,
}: {
  objectType: "DraftProfile" | "Creator" | "User" | "Mission";
  objectId: string;
  backTo: string;
}) {
  return (
    <details className="mt-2 inline-block text-left">
      <summary className="cursor-pointer text-xs text-muted underline hover:text-pink">
        Report {objectType === "User" ? "this user" : "this"}
      </summary>
      <form action={reportAction} className="mt-2 w-72 space-y-2 rounded border border-edge bg-panel p-3">
        <input type="hidden" name="objectType" value={objectType} />
        <input type="hidden" name="objectId" value={objectId} />
        <input type="hidden" name="backTo" value={backTo} />
        <select
          name="reason"
          required
          className="w-full rounded border border-edge bg-ink px-2 py-1.5 text-xs text-chalk"
          defaultValue="HARASSMENT"
        >
          {REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <textarea
          name="detail"
          placeholder="What happened? (optional)"
          rows={2}
          className="w-full rounded border border-edge bg-ink px-2 py-1.5 text-xs text-chalk placeholder:text-muted"
        />
        <button className="w-full rounded bg-pink px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink">
          Send report
        </button>
      </form>
    </details>
  );
}
