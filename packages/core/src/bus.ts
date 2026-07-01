// In-process event bus backing the SSE live feed.
// The Event table is the source of truth (replayable); the bus is fan-out only.
// Swappable for a Redis pub/sub adapter in multi-process deployments —
// subscribers reconnecting replay from the table, so delivery here is best-effort.

export type FeedEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  creatorId?: string | null;
  draftProfileId?: string | null;
};

type Listener = (event: FeedEvent) => void;

const globalForBus = globalThis as unknown as { fameraceBus?: Set<Listener> };
const listeners = (globalForBus.fameraceBus ??= new Set<Listener>());

export function publish(event: FeedEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A broken subscriber must never break the publisher.
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
