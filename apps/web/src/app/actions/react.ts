"use server";

import { allowReaction, roomPublish } from "@/lib/live";

const ALLOWED = new Set(["🔥", "⚡", "💚", "📣", "👑"]);

/** Broadcast a Draft Day reaction to everyone in the room (flood-guarded). */
export async function sendReactionAction(emoji: string): Promise<void> {
  if (!ALLOWED.has(emoji)) return;
  if (!allowReaction()) return;
  roomPublish({ type: "reaction", emoji });
}
