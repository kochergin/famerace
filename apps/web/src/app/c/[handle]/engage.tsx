import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { messages as messagesMod, requests as requestsMod } from "@famerace/core";
import { SectionCard, SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money } from "@/lib/format";
import { currentUser } from "@/lib/session";

async function sendMessageAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await messagesMod.sendPaidMessage(user.id, {
      creatorId: String(formData.get("creatorId")),
      priceCents: Math.round(Number(formData.get("price") || 0) * 100),
      body: String(formData.get("body") ?? ""),
    });
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?messaged=1`);
}

async function orderRequestAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await requestsMod.orderItem(user.id, String(formData.get("itemId")));
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?requested=1`);
}

/** Paid message box (PRD §9.10): respond-to-earn, reject-to-refund. */
export function PaidMessageBox({
  creatorId,
  handle,
  displayName,
  signedIn,
}: {
  creatorId: string;
  handle: string;
  displayName: string;
  signedIn: boolean;
}) {
  if (!signedIn) return null;
  return (
    <SectionCard accent="volt">
      <SectionTitle>Paid message</SectionTitle>
      <p className="mb-3 text-xs text-muted">
        Put a message in front of {displayName}. If they respond, they earn it — if they decline,
        you get a full refund automatically.
      </p>
      <form action={sendMessageAction} className="space-y-2">
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="creatorId" value={creatorId} />
        <textarea
          name="body"
          required
          minLength={10}
          rows={2}
          placeholder="Your message or request…"
          className="w-full rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-volt focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            name="price"
            type="number"
            min={5}
            step={1}
            defaultValue={10}
            required
            className="w-24 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk focus:border-volt focus:outline-none"
            title="Price in dollars"
          />
          <button className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110">
            Send paid message
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

/** Creator Request Menu (PRD §9.11): high-ticket items with escrow. */
export async function RequestMenuSection({
  creatorId,
  handle,
}: {
  creatorId: string;
  handle: string;
}) {
  const [items, user] = await Promise.all([requestsMod.menuFor(creatorId), currentUser()]);
  if (items.length === 0) return null;
  return (
    <SectionCard accent="gold">
      <SectionTitle>Request menu</SectionTitle>
      <p className="mb-3 text-xs text-muted">
        Escrowed until delivered — undelivered requests refund in full.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col justify-between rounded border border-edge p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-bold text-chalk">{item.title}</h3>
              <span className="stat shrink-0 font-bold text-gold">{money(item.priceCents)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Delivered within {item.deliveryDays} days</p>
            {user ? (
              <form action={orderRequestAction} className="mt-3">
                <input type="hidden" name="handle" value={handle} />
                <input type="hidden" name="itemId" value={item.id} />
                <button className="w-full rounded bg-gold px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110">
                  Request
                </button>
              </form>
            ) : (
              <Link href="/join" className="mt-3 block rounded border border-edge px-3 py-2 text-center text-sm font-bold uppercase text-muted">
                Join to request
              </Link>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
