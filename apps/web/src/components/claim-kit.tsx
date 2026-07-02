"use client";

import { useState, useTransition } from "react";

/* Claim campaign kit (the growth choke point is time-to-claim): a prewritten
   "you've been drafted" message fans blast at the creator on every channel.
   Each send records an invite (scout credit) via the passed server action. */
export function ClaimKit({
  message,
  claimPath,
  onSend,
}: {
  message: string;
  claimPath: string;
  onSend: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  // Stable text for SSR (no window at render time); real absolute URL is
  // resolved at click time so the copied/shared message always works.
  const displayUrl = `famerace.fun${claimPath}`;
  const absolute = () =>
    typeof window === "undefined" ? claimPath : new URL(claimPath, window.location.origin).toString();
  const record = () => start(() => onSend().catch(() => {}));

  const channels = [
    { label: "Share on X", href: (u: string) => `https://x.com/intent/post?text=${encodeURIComponent(`${message} ${u}`)}` },
    { label: "WhatsApp", href: (u: string) => `https://wa.me/?text=${encodeURIComponent(`${message} ${u}`)}` },
    { label: "Telegram", href: (u: string) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(message)}` },
  ];

  return (
    <div>
      <p className="break-words rounded border border-edge bg-ink/60 p-3 text-sm text-chrome [overflow-wrap:anywhere]">
        “{message} {displayUrl}”
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(`${message} ${absolute()}`);
            record();
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded bg-volt px-4 py-2 text-chalk hover:brightness-110"
        >
          {copied ? "Copied ✓ — now send it" : "Copy the message"}
        </button>
        {channels.map((channel) => (
          <a
            key={channel.label}
            href={channel.href(claimPath)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              // Rewrite to the absolute URL at click time (SSR-stable markup).
              e.currentTarget.href = channel.href(absolute());
              record();
            }}
            className="rounded border border-edge px-4 py-2 text-chalk transition hover:border-volt hover:text-volt"
          >
            {channel.label}
          </a>
        ))}
      </div>
    </div>
  );
}
