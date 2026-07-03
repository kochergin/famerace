/* Server boot (Next instrumentation hook, nodejs runtime only):
   1. Outbound notification sink — every in-app notification fans out to
      web push (+ email for the high-signal types).
   2. Cross-instance live feed — LISTEN famerace_events re-publishes peers'
      events into this instance's in-process bus, so SSE clients connected
      to any instance see everything.
   3. Sweeps cron — launches, auction settlement, call resolution, renewals
      run every minute behind a Postgres advisory lock (multi-instance safe). */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { notify, publish, admin } = await import("@famerace/core");
  const { sendPushToUser } = await import("@/lib/push");
  const { emailWorthy, sendEmailToUser } = await import("@/lib/email");

  // 1. Notification fan-out (fire and forget; never blocks the caller)
  notify.setNotificationSink((n: { userId: string; type: string; title: string; body?: string | null; link?: string | null }) => {
    void sendPushToUser(n.userId, n).catch(() => undefined);
    if (emailWorthy(n.type)) void sendEmailToUser(n.userId, n).catch(() => undefined);
  });

  // 2. Cross-instance event fan-out over Postgres LISTEN/NOTIFY
  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query("LISTEN famerace_events");
    client.on("notification", (msg) => {
      if (!msg.payload) return;
      try {
        publish(JSON.parse(msg.payload));
      } catch {
        // malformed payload — drop
      }
    });
    client.on("error", () => {
      // connection lost — SSE falls back to local-instance events only
    });
  } catch {
    // no listener connection (e.g. build step) — local bus still works
  }

  // 3. Sweeps every minute, single-runner via a TRANSACTION-scoped advisory
  //    lock. A session-scoped lock on a pooled client is a trap: lock and
  //    unlock can land on different pooled connections, the unlock no-ops,
  //    and the cron silently wedges after the first tick. The xact lock
  //    lives and dies with one interactive transaction spanning the sweep.
  const SWEEP_LOCK = 894_213_007;
  setInterval(async () => {
    try {
      const { prisma } = await import("@famerace/db");
      await prisma.$transaction(
        async (tx) => {
          const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
            SELECT pg_try_advisory_xact_lock(${SWEEP_LOCK}) AS locked`;
          if (!locked) return; // another instance is sweeping
          await admin.runSweeps();
        },
        { timeout: 55_000 },
      );
    } catch {
      // next tick retries
    }
  }, 60_000).unref?.();
}
