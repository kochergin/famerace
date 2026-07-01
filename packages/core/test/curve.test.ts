import { describe, expect, it } from "vitest";
import {
  buyCostCents,
  clearBatchAuction,
  sellProceedsCents,
  spotPriceCents,
  unitsForBudget,
  type CurveParams,
} from "../src/curve";

const CURVE: CurveParams = { basePriceCents: 100, slopeMilliCents: 50 };

describe("bonding curve math", () => {
  it("prices the first unit at the base price", () => {
    expect(spotPriceCents(CURVE, 0)).toBe(100);
    expect(buyCostCents(CURVE, 0, 1)).toBe(100);
  });

  it("cost is additive: buy(n) + buy(m) at rolling supply ≥ buy(n+m)", () => {
    // Split buys can only round up more than a single buy — never less.
    const together = buyCostCents(CURVE, 0, 100);
    const split = buyCostCents(CURVE, 0, 60) + buyCostCents(CURVE, 60, 40);
    expect(split).toBeGreaterThanOrEqual(together);
    expect(split - together).toBeLessThanOrEqual(2); // at most 1 cent per extra rounding
  });

  it("reserve solvency: sell proceeds never exceed buy cost for the same units", () => {
    for (const [supply, units] of [
      [0, 1],
      [0, 100],
      [500, 250],
      [1234, 1234],
      [10_000, 3],
    ] as const) {
      const bought = buyCostCents(CURVE, supply, units);
      const sold = sellProceedsCents(CURVE, supply + units, units);
      expect(sold).toBeLessThanOrEqual(bought);
    }
  });

  it("unitsForBudget is the max affordable quantity", () => {
    for (const budget of [100, 999, 10_000, 123_456]) {
      const units = unitsForBudget(CURVE, 0, budget);
      expect(buyCostCents(CURVE, 0, units)).toBeLessThanOrEqual(budget);
      expect(buyCostCents(CURVE, 0, units + 1)).toBeGreaterThan(budget);
    }
  });

  it("price rises with supply", () => {
    expect(spotPriceCents(CURVE, 1000)).toBeGreaterThan(spotPriceCents(CURVE, 0));
  });
});

describe("batch auction clearing", () => {
  it("allocates all cleared units proportionally with largest-remainder", () => {
    const orders = [
      { id: "a", amountCents: 10_000 },
      { id: "b", amountCents: 20_000 },
      { id: "c", amountCents: 70_000 },
    ];
    const result = clearBatchAuction(CURVE, orders);
    const allocated = result.fills.reduce((sum, fill) => sum + fill.units, 0);
    expect(allocated).toBe(result.totalUnits);
    expect(result.totalSpentCents).toBeLessThanOrEqual(100_000);
    // c pledged 7x more than a — allocation must reflect that (±1 unit rounding)
    const a = result.fills.find((f) => f.id === "a")!.units;
    const c = result.fills.find((f) => f.id === "c")!.units;
    expect(c).toBeGreaterThanOrEqual(a * 6);
  });

  it("is deterministic", () => {
    const orders = [
      { id: "x", amountCents: 3_333 },
      { id: "y", amountCents: 6_667 },
    ];
    const first = clearBatchAuction(CURVE, orders);
    const second = clearBatchAuction(CURVE, orders);
    expect(second).toEqual(first);
  });

  it("handles an empty book", () => {
    const result = clearBatchAuction(CURVE, []);
    expect(result.totalUnits).toBe(0);
    expect(result.fills).toEqual([]);
  });
});
