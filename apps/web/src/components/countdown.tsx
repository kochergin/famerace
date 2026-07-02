"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  if (ms <= 0) return "LIVE";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}D ${hours}H ${String(minutes).padStart(2, "0")}M`;
  return `${hours}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
}

/** Live launch countdown — ticks every second, flips to LIVE at zero (§0B.10). */
export function Countdown({ to, className = "" }: { to: string | Date; className?: string }) {
  const target = typeof to === "string" ? new Date(to).getTime() : to.getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Server render + first client paint match (avoids hydration mismatch),
  // then the ticking starts.
  const label = now === null ? format(target - Date.now()) : format(target - now);
  const isLive = label === "LIVE";
  return (
    <span
      suppressHydrationWarning
      className={`stat ${isLive ? "text-lime" : "pulse-soft"} ${className}`}
    >
      {label}
    </span>
  );
}
