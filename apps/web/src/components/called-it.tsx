"use client";

import { useState } from "react";
import { Confetti } from "@/components/confetti";

/* The "I was right" moment. Winning a call used to be a silent point credit —
   now it's a banner with confetti and a receipt card built for posting. */

export type CallWin = {
  id: string; // notification id (acknowledged on dismiss)
  title: string;
  body: string | null;
  callId: string | null;
};

export function CalledIt({
  wins,
  ackAction,
}: {
  wins: CallWin[];
  ackAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  if (!open || wins.length === 0) return null;
  const first = wins[0]!;

  return (
    <div
      className="card spotlight story-in relative mb-6 overflow-hidden border-lime/50 p-5"
      style={{ "--spot": "rgb(201 247 58 / 0.2)" } as React.CSSProperties}
    >
      <Confetti fireKey={`calledit-${first.id}`} />
      <p className="stat text-[10px] uppercase tracking-[0.35em] text-lime">
        Settled · you were right{wins.length > 1 ? ` ×${wins.length}` : ""}
      </p>
      <p className="display mt-1 text-4xl leading-tight">CALLED IT ✓</p>
      <p className="mt-1 text-sm text-chalk">{first.title.replace(/^Called it ✓\s*/, "")}</p>
      {first.body ? <p className="mt-0.5 text-xs text-muted">{first.body}</p> : null}
      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
        {first.callId ? (
          <a
            href={`/card/called_it/${first.callId}/png`}
            target="_blank"
            className="rounded bg-lime px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink transition hover:brightness-110"
          >
            Get the receipt ↓
          </a>
        ) : null}
        <form
          action={ackAction}
          onSubmit={() => setOpen(false)}
        >
          {wins.map((win) => (
            <input key={win.id} type="hidden" name="ids" value={win.id} />
          ))}
          <button className="rounded border border-edge px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted transition hover:border-lime hover:text-lime">
            Nice
          </button>
        </form>
      </div>
    </div>
  );
}
