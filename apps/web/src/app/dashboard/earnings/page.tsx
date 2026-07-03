import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claim, payouts as payoutsMod } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { Sparkline } from "@/components/sparkline";
import { prisma } from "@famerace/db";
import { SectionTitle, Stat, StatusChip } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, num, timeAgo } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

const BACK = "/dashboard/earnings";

const STREAM_LABELS: Record<string, string> = {
  AUCTION_FILL: "Genesis Pass sales",
  CURVE_TRADE: "Market fees",
  SUBSCRIPTION: "Backstage subscriptions",
  DROP_SALE: "Paid drops",
  TIP: "Tips & boosts",
  MISSION_ESCROW_RELEASE: "Mission funding",
  MESSAGE_FEE: "Paid messages",
};

async function payoutAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    const payout = await payoutsMod.requestPayout(user.id, Math.round(Number(formData.get("amount") || 0) * 100));
    if (payout.status === "APPROVED") await payoutsMod.sendPayout(user.id, payout.id, "SYSTEM");
  });
  revalidatePath(BACK);
  redirect(BACK);
}

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const creator = await claim.creatorForUser(user.id);
  if (!creator) redirect("/dashboard");

  const analytics = await payoutsMod.creatorAnalytics(creator.id);
  const streams = Object.entries(analytics.byStream).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

  // Daily earnings, last 14 days (CREATOR_EARNED credits, bucketed by day).
  const since = new Date(Date.now() - 13 * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const credits = await prisma.ledgerEntry.findMany({
    where: { account: "CREATOR_EARNED", creatorId: creator.id, deltaCents: { gt: 0 }, tx: { createdAt: { gte: since } } },
    include: { tx: { select: { createdAt: true } } },
  });
  const daily = Array.from({ length: 14 }, () => 0);
  for (const entry of credits) {
    const day = Math.floor((entry.tx.createdAt.getTime() - since.getTime()) / 86_400_000);
    if (day >= 0 && day < 14) daily[day]! += entry.deltaCents;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <FormError error={error} />
      <div className="card grid grid-cols-3 gap-4 p-6">
        <Stat label="Available" value={money(analytics.balances.availableCents)} accent="text-lime" />
        <Stat label="Pending payouts" value={money(analytics.balances.pendingCents)} />
        <Stat label="Lifetime earned" value={money(analytics.balances.earnedCents)} accent="text-gold" />
      </div>

      {daily.some((v) => v > 0) ? (
        <section className="card mb-6 p-5">
          <SectionTitle
            right={
              <a href={`/card/creator_revenue/${creator.handle}`} target="_blank" className="text-xs uppercase text-muted hover:text-gold">
                Income card ↓
              </a>
            }
          >
            Last 14 days
          </SectionTitle>
          <Sparkline points={daily} width={640} height={64} className="w-full" />
          <p className="mt-1 text-xs text-muted">Daily earnings across every stream — screenshot-ready proof.</p>
        </section>
      ) : null}

      <SectionTitle>Earnings by stream</SectionTitle>
      <div className="card p-6">
        {streams.length === 0 ? (
          <p className="text-sm text-muted">Nothing earned yet — launch, drop, post.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {streams.map(([type, cents]) => (
              <li key={type} className="flex justify-between">
                <span className="text-chrome">{STREAM_LABELS[type] ?? type}</span>
                <span className="stat font-bold text-chalk">{money(cents ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-edge pt-4">
          <Stat label="Genesis backers" value={num(analytics.passCount)} />
          <Stat label="Backstage members" value={num(analytics.memberCount)} />
          <Stat label="Mission funding" value={money(analytics.missionFundedCents, { compact: true })} accent="text-gold" />
        </div>
      </div>

      <SectionTitle>Request payout</SectionTitle>
      <form action={payoutAction} className="card flex flex-wrap items-center gap-3 p-6">
        <input
          name="amount"
          type="number"
          min={10}
          step="0.01"
          placeholder="Amount $ (min $10)"
          required
          className="w-44 rounded border border-edge bg-ink px-3 py-2.5 text-sm text-chalk placeholder:text-muted focus:border-lime focus:outline-none"
        />
        <SubmitButton pendingLabel="Working…" className="rounded bg-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110">
          Withdraw
        </SubmitButton>
        <p className="w-full text-xs text-muted">
          Payouts of $1,000+ route through compliance review before sending.
        </p>
      </form>

      {analytics.payoutHistory.length > 0 ? (
        <>
          <SectionTitle>Payout history</SectionTitle>
          <ul className="card space-y-2 p-6 text-sm">
            {analytics.payoutHistory.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between">
                <span className="stat text-chalk">{money(payout.amountCents)}</span>
                <span className="flex items-center gap-2 text-muted">
                  {timeAgo(payout.createdAt)} <StatusChip status={payout.status} />
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
