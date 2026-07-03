"use client";

import { useEffect, useState } from "react";
import { Confetti } from "@/components/confetti";
import { LogoMark } from "@/components/logo";
import { Monogram } from "@/components/monogram";
import { ShareRow } from "@/components/share";

/* The signing ceremony. Claiming your page is the biggest moment of a
   creator's FameRace life — it should feel like walking on stage, not like
   submitting a form. Three beats, auto-advancing, then the announce pack. */

export function ClaimCeremony({
  name,
  fans,
  pledgedLabel,
  draftId,
  handle,
}: {
  name: string;
  fans: number;
  pledgedLabel: string;
  draftId: string | null;
  handle: string;
}) {
  const [beat, setBeat] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (beat >= 2) return;
    const t = setTimeout(() => setBeat((b) => b + 1), beat === 0 ? 2200 : 2600);
    return () => clearTimeout(t);
  }, [beat]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center"
      style={{
        backgroundImage:
          "radial-gradient(70% 55% at 50% -5%, rgb(201 247 58 / 0.16), transparent 65%), radial-gradient(45% 40% at 85% 110%, rgb(255 61 141 / 0.12), transparent 60%)",
      }}
    >
      {/* beams */}
      <span aria-hidden className="beam beam-a left-[8%]" />
      <span aria-hidden className="beam beam-pink beam-b right-[8%]" />

      {beat === 0 ? (
        <div key="b0" className="story-in">
          <LogoMark glow className="mx-auto mb-6 h-10 w-10" />
          <p className="stat text-xs uppercase tracking-[0.35em] text-muted">FameRace · Genesis Season</p>
          <h1 className="display mt-4 text-5xl leading-tight sm:text-7xl">
            THE INTERNET
            <br />
            <span className="display-hot">DRAFTED YOU.</span>
          </h1>
        </div>
      ) : beat === 1 ? (
        <div key="b1" className="story-in">
          <Monogram name={name} size="xl" ring="live" className="mx-auto mb-6" />
          <h1 className="display text-6xl sm:text-8xl">{name}</h1>
          <p className="stat mt-5 text-sm text-muted">
            <span className="font-bold text-lime">{fans}</span> fans and{" "}
            <span className="font-bold text-lime">{pledgedLabel}</span> in pledges were waiting for
            this moment.
          </p>
        </div>
      ) : (
        <div key="b2" className="story-in w-full max-w-md">
          <Confetti fireKey={`ceremony-${handle}`} />
          <h1 className="display text-5xl leading-tight sm:text-7xl">
            YOU&apos;RE IN
            <br />
            <span className="text-lime">THE RACE.</span>
          </h1>
          <p className="mt-4 text-sm text-muted">
            Tell your people — every share pulls your backers in before launch.
          </p>
          <div className="relative z-20 mt-6 flex justify-center">
            <ShareRow
              text={`The internet drafted me — ${fans} fans pledged ${pledgedLabel} before I even joined. I just claimed my FameRace launch. #BackTheRise`}
              path={`/c/${handle}`}
              cardPath={draftId ? `/card/claim/${draftId}/png` : undefined}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="relative z-20 mt-8 rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110"
          >
            Start my launch →
          </button>
        </div>
      )}

      <p className="absolute bottom-6 text-[10px] uppercase tracking-[0.3em] text-muted">
        Back the rise ✦ famerace.fun
      </p>
    </div>
  );
}
