"use server";

import { roomPublish } from "@/lib/live";

const ALLOWED = new Set(["🔥", "⚡", "💚", "📣", "👑"]);

/** Broadcast a Draft Day reaction to everyone in the room. */
export async function sendReactionAction(emoji: string): Promise<void> {
  if (!ALLOWED.has(emoji)) return;
  roomPublish({ type: "reaction", emoji });
}
