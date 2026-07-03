"use client";

import { useEffect, useState } from "react";

type FeedEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
  NOMINATION_CREATED: "📥",
  CREATOR_CLAIMED: "✍️",
  THRESHOLD_MET: "🚦",
  LAUNCH_SCHEDULED: "📅",
  AUCTION_SETTLED: "⚖️",
  MARKET_LAUNCHED: "🚀",
  USER_BACKED: "⚡",
  MISSION_LAUNCHED: "🎯",
  MISSION_CONTRIBUTION: "🔥",
  MISSION_FUNDED: "💛",
  MISSION_COMPLETED: "🏁",
  DROP_RELEASED: "🎁",
  QUEST_COMPLETED: "🥷",
  CREW_RANKED_UP: "🏆",
};

/** Live ticker (PRD §0A.9): buys, claims, missions — scrolling as they happen. */
export function LiveFeed({ limit = 14 }: { limit?: number }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/feed");
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as FeedEvent;
        setEvents((current) => {
          if (current.some((e) => e.id === event.id)) return current;
          // Insert by recency, not blindly on top: after a reconnect the server
          // replays old events, which must not jump above newer ones.
          return [event, ...current]
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .slice(0, limit);
        });
      } catch {
        // ignore malformed frames
      }
    };
    return () => source.close();
  }, [limit]);

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="display text-xl">Live</h2>
        <span className={`chip ${live ? "bg-lime/15 text-lime" : "bg-edge text-muted"}`}>
          <span className={live ? "pulse-soft" : ""}>●</span> {live ? "on air" : "connecting"}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="py-4 text-sm text-muted">Waiting for the first signal…</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {events.map((event) => (
            <li key={event.id} className="feed-in flex gap-2 text-chrome">
              <span>{TYPE_ICONS[event.type] ?? "•"}</span>
              <span>{event.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
