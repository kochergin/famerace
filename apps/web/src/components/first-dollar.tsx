"use client";

import { useEffect, useState } from "react";
import { Confetti } from "@/components/confetti";
import { LogoMark } from "@/components/logo";

/* The first-dollar ceremony. Somebody paid to believe in you — the single
   biggest emotional beat of a creator's start, and it should not arrive as
   a quiet row in a table. Shows once (the server records it before render). */

export function FirstDollar({ amountLabel, backers }: { amountLabel: string; backers: number }) {
  const [beat, setBeat] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (beat >= 1) return;
    const t = setTimeout(() => setBeat(1), 2400);
    return () => clearTimeout(t);
  }, [beat]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center"
      style={{
        backgroundImage:
          "radial-gradient(70% 55% at 50% -5%, rgb(201 247 58 / 0.16), transparent 65%), radial-gradient(45% 40% at 15% 110%, rgb(240 195 60 / 0.12), transparent 60%)",
      }}
    >
      <span aria-hidden className="beam beam-a left-[8%]" />
      <span aria-hidden className="beam beam-pink beam-b right-[8%]" />

      {beat === 0 ? (
        <div key="b0" className="story-in">
          <LogoMark glow className="mx-auto mb-6 h-10 w-10" />
          <p className="stat text-xs uppercase tracking-[0.35em] text-muted">FameRace · the money story begins</p>
          <h1 className="display mt-4 text-5xl leading-tight sm:text-7xl">
            SOMEONE PAID
            <br />
            <span className="display-hot">TO BELIEVE IN YOU.</span>
          </h1>
        </div>
      ) : (
        <div key="b1" className="story-in w-full max-w-md">
          <Confetti fireKey="first-dollar" />
          <p className="stat text-xs uppercase tracking-[0.35em] text-muted">Earned so far</p>
          <p className="display mt-2 text-7xl text-lime">{amountLabel}</p>
          <p className="mt-3 text-sm text-muted">
            {backers > 0 ? `${backers} ${backers === 1 ? "person" : "people"} in your corner already. ` : ""}
            This number only knows one trick — go feed it.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="relative z-10 mt-8 rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110"
          >
            Back to the race →
          </button>
        </div>
      )}

      <p className="absolute bottom-6 text-[10px] uppercase tracking-[0.3em] text-muted">
        Back the rise ✦ famerace.fun
      </p>
    </div>
  );
}
