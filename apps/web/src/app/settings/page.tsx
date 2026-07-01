import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notify, DomainError } from "@famerace/core";
import { prisma } from "@famerace/db";
import { FormError } from "@/components/form-error";
import { SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function saveSettingsAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect("/settings", async () => {
    const displayName = String(formData.get("displayName") ?? "").trim();
    if (displayName.length < 1 || displayName.length > 60) {
      throw new DomainError("BAD_NAME", "Display name must be 1–60 characters");
    }
    const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
    const walletAddress = String(formData.get("walletAddress") ?? "").trim();
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      throw new DomainError("BAD_WALLET", "That does not look like a wallet address (EVM or Solana)");
    }
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName,
          avatarUrl: avatarUrl || null,
          country: String(formData.get("country") ?? "").trim() || null,
          walletAddress: walletAddress || null,
        },
      });
    } catch {
      throw new DomainError("WALLET_TAKEN", "That wallet address is already connected to another account");
    }
    await notify.setMuted(user.id, formData.get("notificationsMuted") === "on");
  });
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-sm text-chalk placeholder:text-muted focus:border-lime focus:outline-none";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  return (
    <div className="mx-auto max-w-md">
      <SectionTitle>Settings</SectionTitle>
      {saved ? (
        <p className="mb-3 rounded border border-lime/30 bg-lime/5 px-3 py-2 text-sm text-lime">Saved.</p>
      ) : null}
      <FormError error={error} />
      <form action={saveSettingsAction} className="card space-y-4 p-6">
        <label className="block text-xs uppercase tracking-wide text-muted">
          Display name
          <input name="displayName" defaultValue={fresh.displayName} required className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block text-xs uppercase tracking-wide text-muted">
          Avatar URL
          <input name="avatarUrl" type="url" defaultValue={fresh.avatarUrl ?? ""} placeholder="https://…" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block text-xs uppercase tracking-wide text-muted">
          Country
          <input name="country" defaultValue={fresh.country ?? ""} placeholder="e.g. JP" maxLength={40} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block text-xs uppercase tracking-wide text-muted">
          Wallet address (EVM or Solana)
          <input
            name="walletAddress"
            defaultValue={fresh.walletAddress ?? ""}
            placeholder="0x… — optional, for future on-chain perks"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="notificationsMuted" defaultChecked={fresh.notificationsMuted} className="accent-lime" />
          Mute all notifications
        </label>
        <button className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110">
          Save
        </button>
      </form>
      <p className="mt-3 text-xs text-muted">
        Referral code: <span className="stat text-chalk">{fresh.referralCode}</span> — share{" "}
        <span className="text-chrome">famerace.fun/join?ref={fresh.referralCode}</span>
      </p>
    </div>
  );
}
