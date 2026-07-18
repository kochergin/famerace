/* The FameRace mark: NOVA — a rising star with a comet trail. A four-point
   star (fame, the spark) lifting on a swept trail (the rise, the momentum):
   "Back the rise" as one glyph — a rising star you catch early. One color,
   one gesture, readable at 16px. Authored in a 0..100 box. */

export const MARK_TRAIL_PATH = "M14,94 Q47,76 59,49 Q55,71 41,84 Q29,91 14,94 Z";
export const MARK_STAR_PATH = "M66,13 L74,32 L87,40 L74,48 L66,67 L58,48 L45,40 L58,32 Z";

// The NOVA star on its own, centered — the brand's atomic unit. Recurs as
// bullets, dividers, live pips and confetti so the mark reads as a language.
export const SPARK_PATH = "M50,5 L63,37 L85,50 L63,63 L50,95 L37,63 L15,50 L37,37 Z";

export function LogoMark({
  className = "h-7 w-7",
  glow = false,
  fill = "#c9f73a",
  animate = false,
}: {
  className?: string;
  glow?: boolean;
  fill?: string;
  // `animate` = the ignition: trail draws in on mount, star twinkles. Reserve
  // for focal single-mark moments (login, ceremonies); reduced-motion safe.
  animate?: boolean;
}) {
  return (
    <svg
      viewBox="2 6 96 96"
      className={`${animate ? "nova-animate " : ""}${className}`}
      aria-hidden
      style={glow ? { filter: "drop-shadow(0 0 8px rgb(201 247 58 / 0.55))" } : undefined}
    >
      <path className="nova-trail" d={MARK_TRAIL_PATH} fill={fill} />
      <path className="nova-star" d={MARK_STAR_PATH} fill={fill} />
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
  // `nova-hover` twinkles the star when the wordmark is hovered.
  return (
    <span className="nova-hover inline-flex items-center gap-2">
      <LogoMark className={markClass} />
      <span className={`display leading-none tracking-tight ${textClass}`}>
        <span className="text-chalk">FAME</span>
        <span className="text-lime">RACE</span>
      </span>
    </span>
  );
}

/** The star as a standalone glyph — bullets, live pips, inline accents.
    Inherits `currentColor` by default so it takes the surrounding text color. */
export function NovaSpark({
  className = "h-3 w-3",
  fill = "currentColor",
  twinkle = false,
}: {
  className?: string;
  fill?: string;
  twinkle?: boolean;
}) {
  return (
    <svg viewBox="0 0 100 100" className={`${twinkle ? "spark-twinkle " : ""}${className}`} aria-hidden>
      <path d={SPARK_PATH} fill={fill} />
    </svg>
  );
}

/** A section divider: a hairline that yields to a single lime star. */
export function SparkRule({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-edge" />
      <NovaSpark className="h-3 w-3 text-lime" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-edge" />
    </div>
  );
}
