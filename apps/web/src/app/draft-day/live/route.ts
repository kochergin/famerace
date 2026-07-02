import { roomJoin, roomWatchers, type RoomEvent } from "@/lib/live";

export const dynamic = "force-dynamic";

/** Draft Day live room over SSE: presence count + reaction bursts. */
export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RoomEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup?.();
        }
      };
      send({ type: "presence", count: roomWatchers() + 1 });
      const leave = roomJoin(send);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup?.();
        }
      }, 25_000);
      cleanup = () => {
        leave();
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
