import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notify } from "@famerace/core";
import type { NotificationType } from "@famerace/db";
import { EmptyState, SectionTitle } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function markAllReadAction() {
  "use server";
  const user = await requireCurrentUser();
  await notify.markAllRead(user.id);
  revalidatePath("/notifications");
}

/* Every signal gets a face: glyph + tone per event type, so the list scans
   like a live feed instead of a mail inbox. */
const SIGNAL: Record<NotificationType, { glyph: string; tone: string }> = {
  CREATOR_CLAIMED: { glyph: "✍️", tone: "border-lime/40 bg-lime/10" },
  LAUNCH_STARTING: { glyph: "🚦", tone: "border-lime/40 bg-lime/10" },
  AUCTION_CONFIRMATION: { glyph: "🔔", tone: "border-volt/40 bg-volt/10" },
  MISSION_NEAR_FUNDING: { glyph: "🔥", tone: "border-gold/40 bg-gold/10" },
  MISSION_FUNDED: { glyph: "🏆", tone: "border-gold/40 bg-gold/10" },
  BACKSTAGE_POST: { glyph: "🎟️", tone: "border-velvet bg-velvet/30" },
  DROP_RELEASED: { glyph: "🎁", tone: "border-pink/40 bg-pink/10" },
  QUEST_AVAILABLE: { glyph: "🥷", tone: "border-volt/40 bg-volt/10" },
  QUEST_APPROVED: { glyph: "✅", tone: "border-lime/40 bg-lime/10" },
  CREATOR_MILESTONE: { glyph: "📈", tone: "border-lime/40 bg-lime/10" },
  ROSTER_UPDATE: { glyph: "⭐", tone: "border-gold/40 bg-gold/10" },
  TASTE_SCORE_UPDATE: { glyph: "🎯", tone: "border-pink/40 bg-pink/10" },
  PAYOUT_UPDATE: { glyph: "💸", tone: "border-lime/40 bg-lime/10" },
  TRUST_SAFETY_ALERT: { glyph: "🛡️", tone: "border-velvet bg-velvet/30" },
};

export default async function NotificationsPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const [items, unread] = await Promise.all([
    notify.listNotifications(user.id),
    notify.unreadCount(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle
        right={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <button className="rounded border border-edge px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:border-lime hover:text-lime">
                Mark all read
              </button>
            </form>
          ) : undefined
        }
      >
        Notifications
      </SectionTitle>
      {items.length === 0 ? (
        <EmptyState title="All quiet" hint="Back a creator or fund a mission — the signals follow." />
      ) : (
        <div className="card divide-y divide-edge">
          {items.map((item) => {
            const signal = SIGNAL[item.type] ?? { glyph: "✦", tone: "border-edge bg-panel" };
            const inner = (
              <div className={`flex items-start gap-3 px-4 py-3 ${item.readAt ? "opacity-60" : ""}`}>
                <span
                  aria-hidden
                  className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-base ${signal.tone}`}
                >
                  {signal.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-chalk">
                      {!item.readAt ? <span className="mr-1 text-lime">●</span> : null}
                      {item.title}
                    </p>
                    <span className="stat shrink-0 text-xs text-muted">{timeAgo(item.createdAt)}</span>
                  </div>
                  {item.body ? <p className="mt-0.5 text-sm text-muted">{item.body}</p> : null}
                </div>
              </div>
            );
            return item.link ? (
              <Link key={item.id} href={item.link} className="block transition hover:bg-panel">
                {inner}
              </Link>
            ) : (
              <div key={item.id}>{inner}</div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-center text-xs text-muted">
        Too noisy?{" "}
        <Link href="/settings" className="text-volt underline">
          Mute notifications in settings
        </Link>
      </p>
    </div>
  );
}
