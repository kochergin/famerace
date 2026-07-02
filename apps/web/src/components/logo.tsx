/* The FameRace mark: a sparkline that becomes a star. One dip (the comeback),
   a steep ascent, and a four-point star where the line leaves the chart —
   the whole product in one glyph: back the rise, a star is born. */

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      {/* pink echo trail — the hype behind the rise */}
      <path
        d="M12 52 L26 40 L33 46 L46 26"
        stroke="#ff3d8d"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* the ascent */}
      <path
        d="M8 56 L24 42 L31 48 L45 28"
        stroke="#c9f73a"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the star it becomes */}
      <path
        d="M50 4 L53.4 13.6 L63 17 L53.4 20.4 L50 30 L46.6 20.4 L37 17 L46.6 13.6 Z"
        fill="#c9f73a"
        style={{ filter: "drop-shadow(0 0 6px rgb(201 247 58 / 0.7))" }}
      />
    </svg>
  );
}

export function Logo({
  markClass = "h-7 w-7",
  textClass = "text-2xl",
}: {
  markClass?: string;
  textClass?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={markClass} />
      <span className={`display leading-none tracking-tight ${textClass}`}>
        <span className="text-chalk">FAME</span>
        <span className="text-lime">RACE</span>
      </span>
    </span>
  );
}
