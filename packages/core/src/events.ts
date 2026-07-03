import { prisma, type Db, type EventType, type EventVisibility, type Prisma } from "@famerace/db";
import { publish } from "./bus";

/**
 * Emit a live-feed event: write to the Event table (source of truth,
 * PRD §9A.11) and fan out to in-process SSE subscribers.
 * Accepts a transaction client so events commit atomically with their cause.
 */
export async function emitEvent(
  db: Db | Prisma.TransactionClient,
  input: {
    type: EventType;
    message: string;
    actorId?: string | null;
    creatorId?: string | null;
    draftProfileId?: string | null;
    relatedObjectId?: string | null;
    metadata?: Prisma.InputJsonValue;
    visibility?: EventVisibility;
  },
): Promise<void> {
  const event = await db.event.create({
    data: {
      type: input.type,
      message: input.message,
      actorId: input.actorId ?? null,
      creatorId: input.creatorId ?? null,
      draftProfileId: input.draftProfileId ?? null,
      relatedObjectId: input.relatedObjectId ?? null,
      metadata: input.metadata,
      visibility: input.visibility ?? "PUBLIC",
    },
  });
  if (event.visibility === "PUBLIC") {
    const feedEvent = {
      id: event.id,
      type: event.type,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
      creatorId: event.creatorId,
      draftProfileId: event.draftProfileId,
    };
    publish(feedEvent);
    // Cross-instance fan-out: LISTEN famerace_events re-publishes on peers
    // (instrumentation.ts). Uses the GLOBAL client, not the passed tx — a tx
    // client may already be committed by the time this fires, and best-effort
    // display events don't need transactional delivery.
    void prisma
      .$executeRaw`SELECT pg_notify('famerace_events', ${JSON.stringify(feedEvent)})`
      .catch(() => undefined);
  }
}
