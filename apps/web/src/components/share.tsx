"use client";

import { useState } from "react";

/**
 * Share row (§0A.13: cards are distribution infrastructure). X intent link
 * with prefilled §14 copy, copy-link, and the card image itself.
 */
export function ShareRow({
  text,
  path,
  cardPath,
}: {
  text: string;
  path: string;
  cardPath?: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n\n`)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide">
      <a
        href={intent}
        target="_blank"
        rel="noreferrer"
        className="rounded border border-edge px-3 py-1.5 text-chalk transition hover:border-chalk"
      >
        Share on X
      </a>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(`${text}\n${url}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded border border-edge px-3 py-1.5 text-muted transition hover:border-lime hover:text-lime"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      {cardPath ? (
        <a
          href={cardPath}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-pink/50 px-3 py-1.5 text-pink transition hover:bg-pink/10"
        >
          Card ↓
        </a>
      ) : null}
    </div>
  );
}
