import { subscribe, type FeedEvent } from "@famerace/core";
import { prisma } from "@famerace/db";

export const dynamic = "force-dynamic";

/**
 * Live Launch Feed over SSE (PRD §9A.11). Replays the latest events from the
 * Event table (source of truth), then streams new ones from the bus.
 */
export async function GET(): Promise<Response> {
  const recent = await prisma.event.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: FeedEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup?.();
        }
      };
      for (const event of recent.reverse()) {
        send({
          id: event.id,
          type: event.type,
          message: event.message,
          createdAt: event.createdAt.toISOString(),
          creatorId: event.creatorId,
          draftProfileId: event.draftProfileId,
        });
      }
      const unsubscribe = subscribe(send);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup?.();
        }
      }, 25_000);
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
