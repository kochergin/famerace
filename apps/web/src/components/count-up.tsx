"use client";

import { useEffect, useRef, useState } from "react";

/** Scoreboard number that rolls up on first view (PRD §0B: "big numbers"). */
export function CountUp({
  value,
  prefix = "",
  compact = false,
  className = "",
}: {
  value: number;
  prefix?: string;
  compact?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    // Animate from wherever we were to the new value — the first mount rolls up
    // from 0, and later prop changes (e.g. after a faucet revalidate) animate to
    // the new number instead of freezing on the stale one.
    const target = value;
    const startValue = from.current;
    if (startValue === target) {
      setDisplay(target);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    setDisplay(startValue);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const formatted = compact
    ? Intl.NumberFormat("en-US", { notation: display >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(display)
    : display.toLocaleString("en-US");
  return (
    <span suppressHydrationWarning className={`stat ${className}`}>
      {prefix}
      {formatted}
    </span>
  );
}
