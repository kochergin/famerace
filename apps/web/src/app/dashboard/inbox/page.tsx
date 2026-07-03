import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claim, messages as messagesMod, requests as requestsMod } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { EmptyRow, SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, timeAgo } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";
import { Monogram } from "@/components/monogram";

export const dynamic = "force-dynamic";

const BACK = "/dashboard/inbox";

async function respondAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    await messagesMod.respondToMessage(user.id, String(formData.get("messageId")), String(formData.get("response") ?? ""));
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function rejectAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    await messagesMod.rejectMessage(user.id, String(formData.get("messageId")));
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function requestAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  const orderId = String(formData.get("orderId"));
  const decision = String(formData.get("decision"));
  await withErrorRedirect(BACK, async () => {
    if (decision === "accept") await requestsMod.acceptOrder(user.id, orderId);
    else if (decision === "deliver") await requestsMod.deliverOrder(user.id, orderId);
    else await requestsMod.refundOrder(user.id, orderId);
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function addItemAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    await requestsMod.configureItem(user.id, {
      title: String(formData.get("title") ?? ""),
      priceCents: Math.round(Number(formData.get("price") || 0) * 100),
      deliveryDays: Number(formData.get("deliveryDays") || 7),
    });
  });
  revalidatePath(BACK);
  redirect(BACK);
}

const inputClass =
  "rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-volt focus:outline-none";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const creator = await claim.creatorForUser(user.id);
  if (!creator) redirect("/dashboard");

  const [inbox, orders] = await Promise.all([
    messagesMod.inboxFor(creator.id),
    requestsMod.ordersForCreator(creator.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <FormError error={error} />

      <SectionTitle>Paid messages</SectionTitle>
      {inbox.length === 0 ? (
        <div className="card mb-6 p-5">
          <EmptyRow glyph="💌" title="No paid messages yet — fans pay to reach you here." />
        </div>
      ) : (
        <div className="card mb-6 divide-y divide-edge">
          {inbox.map((message) => (
            <div key={message.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Monogram name={message.fromUser.username} src={message.fromUser.avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="font-semibold text-chalk">@{message.fromUser.username}</span>{" "}
                    <span className="stat font-bold text-gold">paid {money(message.priceCents)}</span>{" "}
                    <span className="text-xs text-muted">to reach you · {timeAgo(message.createdAt)}</span>
                  </span>
                </span>
                <span className="chip bg-edge text-muted">{message.status}</span>
              </div>
              <p className="mt-1 text-chrome">{message.body}</p>
              {message.status === "SENT" ? (
                <div className="mt-2 space-y-2">
                  <form action={respondAction} className="flex gap-2">
                    <input type="hidden" name="messageId" value={message.id} />
                    <input
                      name="response"
                      placeholder="Respond to earn it…"
                      required
                      className={`flex-1 ${inputClass}`}
                    />
                    <SubmitButton pendingLabel="Working…" className="rounded bg-lime px-3 py-1.5 text-xs font-bold uppercase text-ink">
                      Respond
                    </SubmitButton>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="messageId" value={message.id} />
                    <SubmitButton pendingLabel="Working…" className="text-xs text-muted underline hover:text-pink">
                      Decline &amp; refund
                    </SubmitButton>
                  </form>
                </div>
              ) : message.response ? (
                <p className="mt-1 text-xs text-lime">↳ {message.response}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Request menu</SectionTitle>
      <form action={addItemAction} className="card mb-4 flex flex-wrap items-center gap-2 p-4">
        <input name="title" placeholder="Item (e.g. Private listening party)" required className={`min-w-52 flex-1 ${inputClass}`} />
        <input name="price" type="number" min={10} placeholder="$" required className={`w-24 ${inputClass}`} />
        <input name="deliveryDays" type="number" min={1} max={60} defaultValue={7} className={`w-20 ${inputClass}`} title="Delivery days" />
        <SubmitButton pendingLabel="Working…" className="rounded bg-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink">
          Add item
        </SubmitButton>
      </form>

      {orders.length === 0 ? (
        <div className="card p-5">
          <EmptyRow glyph="🎟️" title="No requests yet — your menu is live on your page." />
        </div>
      ) : (
        <div className="card divide-y divide-edge">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <Monogram name={order.user.username} src={order.user.avatarUrl} size="sm" />
                <span className="min-w-0">
                <span className="font-semibold text-chalk">{order.item.title}</span>{" "}
                <span className="text-muted">
                  · {money(order.item.priceCents)} · @{order.user.username} · {timeAgo(order.createdAt)}
                </span>{" "}
                <span className="chip bg-edge text-muted">{order.status}</span>
                </span>
              </span>
              {order.status === "REQUESTED" || order.status === "ACCEPTED" ? (
                <span className="flex gap-2">
                  {order.status === "REQUESTED" ? (
                    <form action={requestAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <SubmitButton pendingLabel="Working…" className="rounded border border-edge px-3 py-1 text-xs font-bold uppercase text-chalk hover:border-lime">
                        Accept
                      </SubmitButton>
                    </form>
                  ) : null}
                  <form action={requestAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="decision" value="deliver" />
                    <SubmitButton pendingLabel="Working…" className="rounded bg-lime px-3 py-1.5 text-xs font-bold uppercase text-ink">
                      Delivered
                    </SubmitButton>
                  </form>
                  <form action={requestAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="decision" value="refund" />
                    <SubmitButton pendingLabel="Working…" className="rounded border border-edge px-3 py-1 text-xs font-bold uppercase text-muted hover:border-pink hover:text-pink">
                      Refund
                    </SubmitButton>
                  </form>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
