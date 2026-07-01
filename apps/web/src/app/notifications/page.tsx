import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notify } from "@famerace/core";
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
            const inner = (
              <div className={`px-4 py-3 ${item.readAt ? "opacity-60" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-chalk">
                    {!item.readAt ? <span className="mr-1 text-lime">●</span> : null}
                    {item.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(item.createdAt)}</span>
                </div>
                {item.body ? <p className="mt-0.5 text-sm text-muted">{item.body}</p> : null}
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
