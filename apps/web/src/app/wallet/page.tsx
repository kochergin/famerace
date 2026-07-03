import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { wallet as walletMod } from "@famerace/core";
import { CountUp } from "@/components/count-up";
import { ShareRow } from "@/components/share";
import { Banner, SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, timeAgo } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Wallet — FameRace" };

async function faucetAction() {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect("/wallet", async () => {
    await walletMod.faucet(user.id, 10_000);
  });
  revalidatePath("/wallet");
  redirect("/wallet?funded=1");
}

async function withdrawAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect("/wallet", async () => {
    await walletMod.withdraw(user.id, Math.round(Number(formData.get("amount") || 0) * 100));
  });
  revalidatePath("/wallet");
  redirect("/wallet?sent=1");
}

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  DEPOSIT: { label: "Deposit", tone: "text-lime" },
  FAUCET: { label: "Top-up", tone: "text-lime" },
  HOLD: { label: "Hold", tone: "text-chrome" },
  RELEASE: { label: "Released", tone: "text-volt" },
  REFUND: { label: "Refund", tone: "text-volt" },
  WITHDRAWAL: { label: "Withdrawal", tone: "text-pink" },
};

/** The wallet: a balance, an address, zero crypto vocabulary. */
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; funded?: string; sent?: string }>;
}) {
  const { error, funded, sent } = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const [address, entries] = await Promise.all([
    walletMod.ensureDepositAddress(user.id),
    walletMod.history(user.id),
  ]);
  const faucetOn = process.env.DEV_FAUCET === "1";

  return (
    <div className="mx-auto max-w-md">
      {funded ? <Banner tone="lime">Funded — you are ready to back someone.</Banner> : null}
      {sent ? <Banner tone="chrome">Withdrawal sent to your wallet address.</Banner> : null}
      {error ? <Banner tone="gold">{error}</Banner> : null}

      <div className="card spotlight fade-up p-6 text-center" style={{ "--spot": "rgb(201 247 58 / 0.14)" } as React.CSSProperties}>
        <p className="stat text-[10px] uppercase tracking-[0.3em] text-muted">Balance · USDC</p>
        <div className="display mt-2 text-6xl text-lime">
          <CountUp value={Math.floor(user.usdcCents / 100)} prefix="$" />
          <span className="text-3xl text-lime/70">.{String(user.usdcCents % 100).padStart(2, "0")}</span>
        </div>
        <p className="mt-2 text-xs text-muted">Spends instantly everywhere on FameRace. No gas, ever.</p>
        {faucetOn ? (
          <form action={faucetAction} className="mt-4">
            <SubmitButton pendingLabel="Funding…" className="rounded bg-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110">
              + Add $100 (demo)
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <section className="card mt-4 p-5">
        <SectionTitle>Deposit</SectionTitle>
        <p className="mb-2 text-xs text-muted">
          Send USDC to your address — it lands here automatically. Or top up with a card via the
          onramp.
        </p>
        <p className="stat break-all rounded border border-edge bg-ink/60 p-3 text-xs text-chrome">{address}</p>
        <div className="mt-2">
          <ShareRow text={`My FameRace deposit address: ${address}`} path={`/wallet`} />
        </div>
      </section>

      <section className="card mt-4 p-5">
        <SectionTitle>Withdraw</SectionTitle>
        {user.walletAddress ? (
          <form action={withdrawAction} className="flex gap-2">
            <input
              name="amount"
              type="number"
              min={5}
              step={0.01}
              placeholder="Amount $"
              required
              className="min-w-0 flex-1 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk focus:border-lime focus:outline-none"
            />
            <SubmitButton pendingLabel="Sending…" className="rounded border border-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-lime hover:bg-lime/10">
              Send
            </SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-muted">
            Add your own wallet address in{" "}
            <Link href="/settings" className="text-lime underline">
              Settings
            </Link>{" "}
            to withdraw.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted">
          Withdrawals go to your address on-chain — usually under a minute.
        </p>
      </section>

      <section className="mt-6">
        <SectionTitle>Activity</SectionTitle>
        {entries.length === 0 ? (
          <p className="card p-5 text-sm text-muted">No movements yet.</p>
        ) : (
          <ol className="card divide-y divide-edge">
            {entries.map((entry) => {
              const kind = KIND_LABEL[entry.kind] ?? { label: entry.kind, tone: "text-chrome" };
              return (
                <li key={entry.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>
                    <span className={`font-bold ${kind.tone}`}>{kind.label}</span>{" "}
                    {entry.memo ? <span className="text-xs text-muted">· {entry.memo}</span> : null}
                  </span>
                  <span className="stat flex items-center gap-3">
                    <span className={entry.deltaCents >= 0 ? "text-lime" : "text-pink"}>
                      {entry.deltaCents >= 0 ? "+" : "−"}
                      {money(Math.abs(entry.deltaCents))}
                    </span>
                    <span className="text-xs text-muted">{timeAgo(entry.createdAt)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
