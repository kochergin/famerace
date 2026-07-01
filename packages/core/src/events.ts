import type { Db, EventType, EventVisibility, Prisma } from "@famerace/db";
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
    publish({
      id: event.id,
      type: event.type,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
      creatorId: event.creatorId,
      draftProfileId: event.draftProfileId,
    });
  }
}
