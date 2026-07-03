"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* The room is alive: while you're on a creator's page, everyone else's moves
   arrive as toasts and the numbers on the page re-render themselves (soft
   router.refresh, throttled). Rides the existing /api/feed SSE stream. */

type FeedEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  creatorId?: string | null;
};

const GLYPHS: Record<string, string> = {
  USER_BACKED: "⚡",
  MARKET_LAUNCHED: "🚀",
  MISSION_CONTRIBUTION: "🔥",
  MISSION_FUNDED: "💛",
  DROP_RELEASED: "🎁",
  QUEST_COMPLETED: "🥷",
  CALL_STAKED: "🎯",
  CALL_RESOLVED: "🏁",
};

/** Events that move money or odds — worth re-rendering the page for. */
const REFRESH_TYPES = new Set(["USER_BACKED", "MISSION_CONTRIBUTION", "MISSION_FUNDED", "DROP_RELEASED", "CALL_STAKED", "CALL_RESOLVED"]);

export function LivePulse({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<FeedEvent[]>([]);
  const mountedAt = useRef(Date.now());
  const lastRefresh = useRef(0);

  useEffect(() => {
    const source = new EventSource("/api/feed");
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as FeedEvent;
        if (event.creatorId !== creatorId) return;
        // Skip the replay burst — only genuinely-live moments toast.
        if (Date.parse(event.createdAt) < mountedAt.current - 5_000) return;
        setToasts((current) => {
          if (current.some((t) => t.id === event.id)) return current;
          return [...current, event].slice(-3);
        });
        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== event.id));
        }, 6_500);
        if (REFRESH_TYPES.has(event.type) && Date.now() - lastRefresh.current > 4_000) {
          lastRefresh.current = Date.now();
          router.refresh();
        }
      } catch {
        // ignore malformed frames
      }
    };
    return () => source.close();
  }, [creatorId, router]);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-20 left-4 z-50 flex w-72 flex-col gap-2 md:bottom-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="feed-in flex items-start gap-2.5 rounded-lg border border-lime/30 bg-ink/95 px-3 py-2.5 shadow-[0_0_24px_rgba(201,247,58,0.15)] backdrop-blur"
        >
          <span aria-hidden className="text-base leading-none">
            {GLYPHS[toast.type] ?? "✦"}
          </span>
          <div className="min-w-0">
            <p className="text-xs leading-snug text-chalk">{toast.message}</p>
            <p className="stat mt-0.5 text-[10px] uppercase tracking-widest text-lime">live · just now</p>
          </div>
        </div>
      ))}
    </div>
  );
}
