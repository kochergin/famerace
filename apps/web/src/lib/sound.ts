"use client";

/* Tiny synthesized sound layer — no assets, no dependencies, OFF by default.
   Three sounds, all under 200ms, tuned quiet: the arena hums, it doesn't
   shout. Enable via the toggle in Settings (localStorage). */

const KEY = "famerace_sound";

export function soundEnabled(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // storage unavailable — sound stays off
  }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const context = audio();
  if (!context) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, context.currentTime + at);
  gain.gain.linearRampToValueAtTime(volume, context.currentTime + at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + at + duration);
  osc.connect(gain).connect(context.destination);
  osc.start(context.currentTime + at);
  osc.stop(context.currentTime + at + duration + 0.05);
}

/** click: stake/press · pop: confetti burst · chime: money landed */
export function playSound(kind: "click" | "pop" | "chime"): void {
  if (!soundEnabled()) return;
  switch (kind) {
    case "click":
      tone(1800, 0, 0.05, 0.04, "square");
      break;
    case "pop":
      tone(520, 0, 0.09, 0.07, "triangle");
      tone(880, 0.05, 0.12, 0.05, "triangle");
      break;
    case "chime":
      tone(660, 0, 0.16, 0.06);
      tone(990, 0.09, 0.2, 0.05);
      tone(1320, 0.18, 0.24, 0.04);
      break;
  }
}

/** One short tick for mobile taps — silent no-op everywhere else. */
export function haptic(): void {
  try {
    if (typeof navigator !== "undefined") navigator.vibrate?.(12);
  } catch {
    // not supported
  }
}
