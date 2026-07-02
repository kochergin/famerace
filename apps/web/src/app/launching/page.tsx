import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auction, demand } from "@famerace/core";
import { Countdown } from "@/components/countdown";
import { Monogram } from "@/components/monogram";
import { EmptyState, FuelBar, SectionTitle, Stat } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { CATEGORY_LABELS, money, num } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function confirmAction(formData: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect("/launching", async () => {
    await demand.confirmDemandOrder(user.id, String(formData.get("orderId")));
  });
  revalidatePath("/launching");
}

async function declineAction(formData: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect("/launching", async () => {
    await demand.cancelDemandOrder(user.id, String(formData.get("orderId")));
  });
  revalidatePath("/launching");
}

export default async function LaunchingPage() {
  // Opportunistic settlement sweep: any auction past its end time settles on
  // page load (a cron worker does this in production; both paths are idempotent).
  await auction.settleDueLaunches();

  const [creators, user] = await Promise.all([auction.launchingSoon(), currentUser()]);
  const myOrders = user ? await auction.ordersInWindow(user.id) : [];

  return (
    <div>
      <SectionTitle>Launching Soon</SectionTitle>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Verified creators past the launch threshold. Confirmed demand clears through a single opening
        auction — every market opens with a crowd.
      </p>

      {myOrders.length > 0 ? (
        <section className="card mb-8 border-lime/40 p-5">
          <h2 className="display text-xl text-lime">Confirm your opening orders</h2>
          <p className="mt-1 text-xs text-muted">
            Final confirmation window — confirm to be included in the opening fill, or decline for a
            full release of your hold.
          </p>
          <div className="mt-3 space-y-2">
            {myOrders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-edge p-3 text-sm">
                <span>
                  <span className="font-semibold text-chalk">{order.creator?.displayName}</span>{" "}
                  <span className="text-muted">
                    · {order.intentType.replaceAll("_", " ").toLowerCase()} ·{" "}
                    <span className="stat">{money(order.amountCents)}</span>
                  </span>
                </span>
                <span className="flex gap-2">
                  <form action={confirmAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button className="rounded bg-lime px-3 py-1.5 text-xs font-bold uppercase text-ink">
                      Confirm
                    </button>
                  </form>
                  <form action={declineAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button className="rounded border border-edge px-3 py-1.5 text-xs font-bold uppercase text-muted hover:border-pink hover:text-pink">
                      Decline
                    </button>
                  </form>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {creators.length === 0 ? (
        <EmptyState
          title="No launches on the calendar"
          hint="Watch the Draft Board — creators crossing the threshold appear here first."
        />
      ) : (
        <div className="space-y-4">
          {creators.map((creator) => (
            <Link
              key={creator.id}
              href={`/c/${creator.handle}`}
              className="card spotlight block p-6"
              style={{ "--spot": "rgb(201 247 58 / 0.1)", "--glow": "rgb(201 247 58 / 0.25)" } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-center gap-5">
                <Monogram name={creator.displayName} size="xl" ring="draft" />
                <div className="min-w-0 flex-1">
                  <p className="stat text-xs text-muted">
                    {creator.market ? `$${creator.market.ticker}` : ""} · {CATEGORY_LABELS[creator.category]}
                  </p>
                  <h3 className="display mt-1 text-4xl sm:text-5xl">{creator.displayName}</h3>
                </div>
                {creator.launchAt ? (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Launch in</p>
                    <Countdown to={creator.launchAt.toISOString()} className="display block text-4xl text-lime" />
                  </div>
                ) : null}
              </div>
              {creator.launchThreshold ? (
                <div className="mt-5 border-t border-edge pt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>
                      <span className="stat font-bold text-chalk">{num(creator.launchThreshold.confirmedBackers)}</span>{" "}
                      confirmed backers
                    </span>
                    <span>
                      <span className="stat font-bold text-lime">
                        {money(creator.launchThreshold.confirmedDemandCents, { compact: true })}
                      </span>{" "}
                      confirmed demand
                    </span>
                  </div>
                  <FuelBar
                    value={creator.launchThreshold.confirmedDemandCents}
                    max={creator.launchThreshold.requiredDemandCents}
                  />
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
