/* Draft Day live room: in-process presence + reaction fan-out (same
   single-process model as the feed bus; swappable for Redis pub/sub). */

export type RoomEvent = { type: "presence"; count: number } | { type: "reaction"; emoji: string };
type RoomListener = (event: RoomEvent) => void;

const globalForRoom = globalThis as unknown as {
  fameraceRoom?: { listeners: Set<RoomListener>; watchers: number };
};
const room = (globalForRoom.fameraceRoom ??= { listeners: new Set<RoomListener>(), watchers: 0 });

export function roomPublish(event: RoomEvent): void {
  for (const listener of room.listeners) {
    try {
      listener(event);
    } catch {
      // never let one dead stream break the room
    }
  }
}

export function roomJoin(listener: RoomListener): () => void {
  room.listeners.add(listener);
  room.watchers += 1;
  roomPublish({ type: "presence", count: room.watchers });
  return () => {
    room.listeners.delete(listener);
    room.watchers = Math.max(0, room.watchers - 1);
    roomPublish({ type: "presence", count: room.watchers });
  };
}

export function roomWatchers(): number {
  return room.watchers;
}

// Reaction flood guard: a simple process-wide token bucket. Reactions are
// fan-out-to-everyone, so an abuser spamming the action would melt every
// open stream — drop excess silently instead.
const bucket = { tokens: 20, last: Date.now() };
export function allowReaction(): boolean {
  const now = Date.now();
  bucket.tokens = Math.min(20, bucket.tokens + ((now - bucket.last) / 1000) * 10);
  bucket.last = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}
