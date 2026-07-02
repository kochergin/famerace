import { describe, expect, it } from "vitest";
import { showState } from "../src/modules/draftday";

const T0 = new Date("2026-07-01T18:00:00Z");
const at = (offsetMs: number) => new Date(T0.getTime() + offsetMs);
const INTERVAL = 30_000;

describe("draft day: synced show state", () => {
  it("is none without a scheduled draft day", () => {
    expect(showState({ draftDayAt: null, now: T0, lineupSize: 8 })).toEqual({ state: "none", revealed: 0 });
  });

  it("counts down before, reveals rank-by-rank on the shared clock, then goes after", () => {
    const args = { draftDayAt: T0, lineupSize: 8, intervalMs: INTERVAL };
    expect(showState({ ...args, now: at(-60_000) })).toEqual({ state: "before", revealed: 0 });
    // T+0: first card flips immediately
    expect(showState({ ...args, now: at(0) })).toEqual({ state: "live", revealed: 1 });
    // T+95s → 4th card (0,30,60,90)
    expect(showState({ ...args, now: at(95_000) })).toEqual({ state: "live", revealed: 4 });
    // Reveal count clamps at lineup size and holds live through the afterglow
    expect(showState({ ...args, now: at(10 * 60_000) })).toEqual({ state: "live", revealed: 8 });
    // Long after: state flips to after with everything revealed
    expect(showState({ ...args, now: at(3 * 3600_000) })).toEqual({ state: "after", revealed: 8 });
  });

  it("two viewers at the same instant always see the same board", () => {
    const args = { draftDayAt: T0, lineupSize: 100, intervalMs: INTERVAL };
    const a = showState({ ...args, now: at(47 * 30_000 + 12_345) });
    const b = showState({ ...args, now: at(47 * 30_000 + 12_345) });
    expect(a).toEqual(b);
    expect(a.revealed).toBe(48);
  });
});
