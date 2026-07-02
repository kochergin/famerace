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
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (value === 0) return;
    const duration = 900;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    setDisplay(0);
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
