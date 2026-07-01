// Linear bonding curve, integer-exact (PRD §9.6).
//
//   unit price at supply s (millicents) = basePriceCents·1000 + slopeMilliCents·s
//
// Buying n units starting at supply s costs the sum of n consecutive unit
// prices. All math in integer millicents; buys round cost UP to a cent and
// sells round proceeds DOWN, so rounding always favors the reserve — the
// reserve can never be drained below the curve's buyback obligation.

export type CurveParams = {
  basePriceCents: number;
  slopeMilliCents: number;
};

function costMilli(params: CurveParams, supply: number, units: number): bigint {
  const base = BigInt(params.basePriceCents) * 1000n;
  const slope = BigInt(params.slopeMilliCents);
  const s = BigInt(supply);
  const n = BigInt(units);
  // Σ_{i=0}^{n-1} (base + slope·(s+i)) = n·base + slope·(n·s + n(n−1)/2)
  return n * base + slope * (n * s + (n * (n - 1n)) / 2n);
}

/** Cost in cents to buy `units` starting at `supply` (rounded up). */
export function buyCostCents(params: CurveParams, supply: number, units: number): number {
  if (units <= 0) return 0;
  const milli = costMilli(params, supply, units);
  return Number((milli + 999n) / 1000n);
}

/** Proceeds in cents for selling `units` when supply is `supply` (rounded down). */
export function sellProceedsCents(params: CurveParams, supply: number, units: number): number {
  if (units <= 0 || units > supply) return 0;
  const milli = costMilli(params, supply - units, units);
  return Number(milli / 1000n);
}

/** Max units affordable with `budgetCents` starting at `supply` (binary search). */
export function unitsForBudget(params: CurveParams, supply: number, budgetCents: number): number {
  if (budgetCents <= 0) return 0;
  let lo = 0;
  let hi = 1;
  while (buyCostCents(params, supply, hi) <= budgetCents) {
    lo = hi;
    hi *= 2;
    if (hi > 1_000_000_000) break; // hard cap: one billion units
  }
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (buyCostCents(params, supply, mid) <= budgetCents) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Spot price in cents of the next unit at `supply` (rounded up). */
export function spotPriceCents(params: CurveParams, supply: number): number {
  return buyCostCents(params, supply, 1);
}

/**
 * Batch-auction clearing (PRD §9A.5): one fair fill for all confirmed orders.
 * The whole pot buys U units from supply 0; each order receives units
 * proportional to its amount (largest-remainder rounding, earliest order
 * breaks ties). Deterministic given the same inputs.
 */
export function clearBatchAuction(
  params: CurveParams,
  orders: { id: string; amountCents: number }[],
): {
  totalUnits: number;
  totalSpentCents: number;
  clearingPriceCents: number;
  fills: { id: string; units: number; amountCents: number }[];
} {
  const pot = orders.reduce((sum, order) => sum + order.amountCents, 0);
  const totalUnits = unitsForBudget(params, 0, pot);
  if (totalUnits === 0 || pot === 0) {
    return {
      totalUnits: 0,
      totalSpentCents: 0,
      clearingPriceCents: spotPriceCents(params, 0),
      fills: orders.map((order) => ({ id: order.id, units: 0, amountCents: order.amountCents })),
    };
  }
  const totalSpentCents = buyCostCents(params, 0, totalUnits);

  // Proportional allocation with largest-remainder distribution.
  const exact = orders.map((order, index) => {
    const numerator = BigInt(order.amountCents) * BigInt(totalUnits);
    const whole = Number(numerator / BigInt(pot));
    const remainder = Number(numerator % BigInt(pot));
    return { index, id: order.id, amountCents: order.amountCents, whole, remainder };
  });
  let allocated = exact.reduce((sum, entry) => sum + entry.whole, 0);
  const byRemainder = [...exact].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );
  for (const entry of byRemainder) {
    if (allocated >= totalUnits) break;
    entry.whole += 1;
    allocated += 1;
  }

  return {
    totalUnits,
    totalSpentCents,
    clearingPriceCents: Math.ceil(totalSpentCents / totalUnits),
    fills: exact.map((entry) => ({ id: entry.id, units: entry.whole, amountCents: entry.amountCents })),
  };
}
