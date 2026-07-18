"use client";

import { useEffect, useRef, useState } from "react";
import { sendReactionAction } from "@/app/actions/react";
import { NovaSpark } from "@/components/logo";

/* The crowd layer: live watcher count + emoji reactions floating up the side.
   Every reaction is broadcast — you see the room reacting in real time. */

const EMOJI = ["🔥", "⚡", "💚", "📣", "👑"];

type Floater = { id: number; emoji: string; left: number; drift: number };

export function DraftDayLive() {
  const [watching, setWatching] = useState<number | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const nextId = useRef(0);

  const burst = (emoji: string) => {
    const id = nextId.current;
    nextId.current += 1;
    setFloaters((old) => [
      ...old.slice(-30),
      { id, emoji, left: 6 + ((id * 13) % 18), drift: ((id * 7) % 10) - 5 },
    ]);
    setTimeout(() => setFloaters((old) => old.filter((f) => f.id !== id)), 3600);
  };

  useEffect(() => {
    const source = new EventSource("/draft-day/live");
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as { type: string; count?: number; emoji?: string };
        if (event.type === "presence" && typeof event.count === "number") setWatching(event.count);
        if (event.type === "reaction" && event.emoji) burst(event.emoji);
      } catch {
        // ignore malformed frames
      }
    };
    return () => source.close();
  }, []);

  return (
    <>
      {/* floating reactions rise along the right edge */}
      <div aria-hidden className="pointer-events-none fixed inset-y-0 right-0 z-40 w-24 overflow-hidden">
        {floaters.map((f) => (
          <span
            key={f.id}
            className="react-float absolute bottom-24 text-2xl"
            style={{ right: `${f.left}px`, "--drift": `${f.drift}px` } as React.CSSProperties}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <span className="stat text-xs uppercase tracking-widest text-muted">
          <NovaSpark twinkle className="mr-1.5 inline-block h-3.5 w-3.5 align-middle text-lime" />
          <span className="font-bold text-chalk" suppressHydrationWarning>
            {watching ?? "—"}
          </span>{" "}
          watching now
        </span>
        <span className="flex gap-1.5">
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                burst(emoji); // optimistic — the echo comes back via SSE for everyone else
                void sendReactionAction(emoji);
              }}
              className="rounded-md border border-edge px-2.5 py-1.5 text-lg transition hover:scale-110 hover:border-lime"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </span>
      </div>
    </>
  );
}
