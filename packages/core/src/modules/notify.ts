import { prisma, type Db, type NotificationType, type Prisma } from "@famerace/db";

// Notification helper (PRD §9.19) honoring the user's mute setting (§9.1).
// All modules create notifications through this so preferences apply in one place.

/* Outbound delivery seam: the web layer registers a sink at boot
   (instrumentation) that fans notifications out to web push / email.
   Fire-and-forget — a broken channel never breaks the transaction. */
export type OutboundNotification = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};
type NotificationSink = (n: OutboundNotification) => void;
const globalForSink = globalThis as unknown as { fameraceNotifySink?: NotificationSink };
export function setNotificationSink(sink: NotificationSink): void {
  globalForSink.fameraceNotifySink = sink;
}

export async function notify(
  db: Db | Prisma.TransactionClient,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
  },
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { notificationsMuted: true, status: true },
  });
  if (!user || user.status !== "ACTIVE" || user.notificationsMuted) return;
  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    },
  });
  globalForSink.fameraceNotifySink?.({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
  });
}

export async function listNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.notification.updateMany({
    where: { userId, id: { in: ids }, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function setMuted(userId: string, muted: boolean): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { notificationsMuted: muted } });
}
