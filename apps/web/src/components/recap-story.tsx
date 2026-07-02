"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CountUp } from "@/components/count-up";
import { Confetti } from "@/components/confetti";
import { LogoMark } from "@/components/logo";
import { Monogram, gradientPair } from "@/components/monogram";
import { RecapVideoButton } from "@/components/recap-video";

/* Season Recap story player (PRD §0B "Spotify Wrapped" energy):
   full-screen slides, tap/arrow navigation, auto-advance, share outro. */

export type RecapSlide =
  | { kind: "cover"; name: string; username: string; avatarUrl: string | null }
  | { kind: "first"; name: string; avatarUrl: string | null; whenLabel: string; amountLabel: string }
  | { kind: "numbers"; items: { label: string; value: number; prefix?: string; accent: string }[] }
  | {
      kind: "call";
      name: string;
      avatarUrl: string | null;
      ticker: string;
      backerRank: number | null;
      holderCount: number;
      fameScore: number;
    }
  | { kind: "crowd"; crewName: string | null; crewRank: number | null; xp: number; quests: number }
  | { kind: "taste"; score: number; rank: number; ofUsers: number; drivers: { label: string; points: number }[] }
  | { kind: "outro"; username: string };

const HOLD_MS = 6500;

const ACCENTS: Record<RecapSlide["kind"], string> = {
  cover: "#c9f73a",
  first: "#3d7bff",
  numbers: "#f4f4f0",
  call: "#f0c33c",
  crowd: "#ff3d8d",
  taste: "#c9f73a",
  outro: "#ff3d8d",
};

export function RecapStory({ slides, username }: { slides: RecapSlide[]; username: string }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index]!;
  const last = index === slides.length - 1;

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + delta))),
    [slides.length],
  );

  useEffect(() => {
    if (last) return;
    const t = setTimeout(() => go(1), HOLD_MS);
    return () => clearTimeout(t);
  }, [index, last, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const accent = ACCENTS[slide.kind];
  const [gFrom, gTo] = useMemo(() => gradientPair(username), [username]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-ink"
      style={{
        backgroundImage: `radial-gradient(80% 60% at 50% -10%, ${accent}22, transparent 65%), radial-gradient(60% 50% at 90% 110%, ${gTo}1e, transparent 60%), radial-gradient(50% 45% at 8% 100%, ${gFrom}18, transparent 60%)`,
      }}
    >
      {/* progress rail */}
      <div className="flex gap-1.5 px-4 pt-4">
        {slides.map((s, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-chalk/15">
            <span
              key={`${i}-${index}`}
              className="block h-full rounded-full bg-chalk"
              style={
                i < index
                  ? { width: "100%" }
                  : i === index && !last
                    ? { animation: `story-fill ${HOLD_MS}ms linear forwards` }
                    : i === index
                      ? { width: "100%" }
                      : { width: "0%" }
              }
            />
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 pt-3 text-xs uppercase tracking-widest text-muted">
        <span className="display inline-flex items-center gap-1.5 text-sm text-lime">
          <LogoMark className="h-4 w-4" /> FameRace · Season 1
        </span>
        <Link href="/roster" className="rounded px-2 py-1 hover:text-chalk" aria-label="Close recap">
          ✕
        </Link>
      </div>

      {/* tap zones */}
      <button aria-label="Previous" className="absolute inset-y-16 left-0 z-10 w-1/4 cursor-w-resize" onClick={() => go(-1)} />
      <button aria-label="Next" className="absolute inset-y-16 right-0 z-10 w-2/4 cursor-e-resize" onClick={() => go(1)} />

      {/* slide */}
      <div key={index} className="story-in relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <SlideBody slide={slide} allSlides={slides} username={username} />
      </div>
      {last ? <Confetti fireKey={`recap-${username}`} /> : null}
    </div>
  );
}

function Big({ children, tint = "text-chalk" }: { children: React.ReactNode; tint?: string }) {
  return <p className={`display text-5xl leading-[1.05] sm:text-6xl ${tint}`}>{children}</p>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="stat mb-4 text-xs uppercase tracking-[0.25em] text-muted">{children}</p>;
}

function SlideBody({
  slide,
  allSlides,
  username,
}: {
  slide: RecapSlide;
  allSlides: RecapSlide[];
  username: string;
}) {
  switch (slide.kind) {
    case "cover":
      return (
        <>
          <Monogram name={slide.name} src={slide.avatarUrl} size="xl" ring="live" className="mb-6" />
          <Eyebrow>@{slide.username}</Eyebrow>
          <Big>
            Your season
            <br />
            <span className="text-lime">so far.</span>
          </Big>
          <p className="mt-6 text-sm text-muted">Tap to play →</p>
        </>
      );
    case "first":
      return (
        <>
          <Eyebrow>It started {slide.whenLabel}</Eyebrow>
          <Big>
            You called
            <br />
            <span className="text-volt">{slide.name}</span>
            <br />
            early.
          </Big>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Monogram name={slide.name} src={slide.avatarUrl} size="md" ring="draft" />
            <p className="stat text-sm text-muted">{slide.amountLabel} — before the crowd showed up.</p>
          </div>
        </>
      );
    case "numbers":
      return (
        <>
          <Eyebrow>The receipts</Eyebrow>
          <div className="grid w-full grid-cols-2 gap-6">
            {slide.items.map((item) => (
              <div key={item.label}>
                <div className={`display text-5xl ${item.accent}`}>
                  <CountUp value={item.value} prefix={item.prefix ?? ""} />
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-widest text-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </>
      );
    case "call":
      return (
        <>
          <Eyebrow>Your biggest call</Eyebrow>
          <Monogram name={slide.name} src={slide.avatarUrl} size="xl" ring="gold" className="mb-5" />
          <Big tint="text-gold">{slide.name}</Big>
          <p className="stat mt-4 text-sm text-muted">
            ${slide.ticker} · Fame {slide.fameScore}
            {slide.backerRank ? (
              <>
                {" "}
                · you are backer <span className="font-bold text-gold">#{slide.backerRank}</span> of{" "}
                {slide.holderCount}
              </>
            ) : null}
          </p>
          {slide.backerRank && slide.backerRank <= 10 ? (
            <p className="chip mt-4 border border-gold/50 bg-gold/10 text-gold">First ten. Forever.</p>
          ) : null}
        </>
      );
    case "crowd":
      return (
        <>
          <Eyebrow>You did not just watch</Eyebrow>
          <Big>
            {slide.crewName ? (
              <>
                Riding with
                <br />
                <span className="text-pink">{slide.crewName}</span>
              </>
            ) : (
              <>
                Street Team
                <br />
                <span className="text-pink">energy.</span>
              </>
            )}
          </Big>
          <p className="stat mt-6 text-sm text-muted">
            {slide.crewRank ? `Crew rank #${slide.crewRank} · ` : ""}
            {slide.quests} quests done · {slide.xp} XP
          </p>
        </>
      );
    case "taste": {
      const pct = Math.min(100, Math.max(0, slide.score));
      return (
        <>
          <Eyebrow>The reveal</Eyebrow>
          <div className="relative mb-6 inline-flex h-44 w-44 items-center justify-center">
            <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90 h-full w-full">
              <circle cx="64" cy="64" r="52" fill="none" stroke="rgb(244 244 240 / 0.12)" strokeWidth="8" />
              <circle
                cx="64"
                cy="64"
                r="52"
                fill="none"
                stroke="#c9f73a"
                strokeWidth="8"
                strokeLinecap="round"
                pathLength={100}
                style={{
                  strokeDasharray: `${pct} ${100 - pct}`,
                  filter: "drop-shadow(0 0 10px rgb(201 247 58 / 0.5))",
                }}
              />
            </svg>
            <div>
              <div className="display text-6xl text-lime">
                <CountUp value={slide.score} />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-muted">Taste Score</p>
            </div>
          </div>
          <Big>
            Taste rank <span className="text-lime">#{slide.rank}</span>
          </Big>
          <p className="stat mt-3 text-sm text-muted">of {slide.ofUsers} scouts this season</p>
          {slide.drivers.length ? (
            <p className="mt-4 text-xs text-muted">
              Biggest driver: <span className="text-chalk">{slide.drivers[0]!.label}</span> (+{slide.drivers[0]!.points})
            </p>
          ) : null}
        </>
      );
    }
    case "outro":
      return (
        <>
          <Eyebrow>Season 1 is just starting</Eyebrow>
          <Big>
            Prove it.
            <br />
            <span className="text-pink">Share the story.</span>
          </Big>
          <div className="relative z-20 mt-8 flex flex-wrap justify-center gap-2">
            <RecapVideoButton slides={allSlides} username={username} />
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("My FameRace season so far — found them early, backed the rise. #BackTheRise")}`}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-chalk px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-90"
            >
              Share on X
            </a>
            <a
              href={`/card/taste_score/${slide.username}`}
              target="_blank"
              className="rounded border border-lime px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-lime hover:bg-lime/10"
            >
              Taste card ↓
            </a>
            <a
              href={`/card/roster/${slide.username}`}
              target="_blank"
              className="rounded border border-edge px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-chrome hover:border-chrome"
            >
              Roster card ↓
            </a>
          </div>
          <Link href="/roster" className="relative z-20 mt-6 text-xs uppercase tracking-widest text-muted hover:text-chalk">
            Back to my roster →
          </Link>
        </>
      );
  }
}
