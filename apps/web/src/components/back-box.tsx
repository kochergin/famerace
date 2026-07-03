"use client";

import { useMemo, useState } from "react";
import { buyCostCents, spotPriceCents, unitsForBudget } from "@famerace/core/src/curve";

/* The trade sheet as a toy: pick an amount and watch the curve answer —
   units, average price, where the price lands, and the backer number you'd
   claim. Mirrors market.quoteBuy exactly (same integer curve, same
   floor-per-fee split), labeled ≈ because the curve can move before you land. */

export function BackBox({
  action,
  handle,
  marketId,
  ticker,
  curve,
  supply,
  feeBps,
  nextBackerRank,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  handle: string;
  marketId: string;
  ticker: string;
  curve: { basePriceCents: number; slopeMilliCents: number };
  supply: number;
  feeBps: { creator: number; protocol: number; scout: number };
  nextBackerRank: number | null;
  children: React.ReactNode;
}) {
  const [tier, setTier] = useState(2500);
  const [custom, setCustom] = useState("");

  const spendCents = useMemo(() => {
    const c = Number(custom);
    return c > 0 ? Math.round(c * 100) : tier;
  }, [custom, tier]);

  const quote = useMemo(() => {
    const totalFee =
      Math.floor((spendCents * feeBps.creator) / 10_000) +
      Math.floor((spendCents * feeBps.protocol) / 10_000) +
      Math.floor((spendCents * feeBps.scout) / 10_000);
    const netCents = spendCents - totalFee;
    const units = unitsForBudget(curve, supply, netCents);
    const costCents = buyCostCents(curve, supply, units);
    const priceAfter = spotPriceCents(curve, supply + units);
    return { units, avgCents: units > 0 ? costCents / units : 0, priceAfter };
  }, [spendCents, curve, supply, feeBps]);

  return (
    <form action={action} className="flex flex-1 flex-col gap-3">
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="marketId" value={marketId} />
      <div className="flex flex-wrap gap-2">
        {[2500, 10000, 50000].map((cents) => (
          <label key={cents} className="cursor-pointer">
            <input
              type="radio"
              name="tier"
              value={cents}
              checked={custom === "" && tier === cents}
              onChange={() => {
                setTier(cents);
                setCustom("");
              }}
              className="peer sr-only"
            />
            <span className="stat inline-block rounded border border-edge px-4 py-2 text-sm font-bold transition peer-checked:border-lime peer-checked:text-lime">
              ${(cents / 100).toLocaleString("en-US")}
            </span>
          </label>
        ))}
        <input
          name="customAmount"
          type="number"
          min={1}
          step={1}
          placeholder="Custom $"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="w-24 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-lime focus:outline-none"
        />
      </div>

      {/* The curve answers live */}
      <div className="rounded border border-lime/25 bg-lime/5 px-3 py-2.5">
        <div key={`${quote.units}-${spendCents}`} className="feed-in flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="stat text-xl font-bold text-lime">
            ≈ {quote.units.toLocaleString("en-US")} ${ticker}
          </span>
          <span className="stat text-xs text-muted">
            avg ${(quote.avgCents / 100).toFixed(2)} · price after ${(quote.priceAfter / 100).toFixed(2)}
          </span>
          {nextBackerRank ? (
            <span className="stat text-xs font-bold text-gold">you&apos;d be backer #{nextBackerRank}</span>
          ) : null}
        </div>
      </div>

      <ul className="list-inside list-disc text-xs text-muted">
        <li>${ticker} access/status units on the live curve</li>
        <li>Permanent backer rank on first back</li>
        <li>Holder-gated Backstage eligibility</li>
      </ul>
      <div className="mt-auto">{children}</div>
    </form>
  );
}
