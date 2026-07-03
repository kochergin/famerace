/* The FameRace mark: the Star Flag. A race flag flying at full speed with a
   five-point star cut out of it in negative space — fame (the star), the race
   (the flag), and the product's core act (planting your flag on someone's
   rise) in one solid glyph. One color, one shape, readable at 16px. */

export const MARK_FLAG_PATH =
  "M13 8 C 28 0, 40 16, 59 5 L 59 36 C 44 47, 32 31, 13 39 Z " +
  "M33.45,10.57 L38.49,17.89 L47.19,16.12 L41.79,23.17 L46.15,30.90 L37.78,27.94 " +
  "L31.78,34.48 L32.01,25.61 L23.93,21.92 L32.44,19.39 Z";

export function LogoMark({
  className = "h-7 w-7",
  glow = false,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      style={glow ? { filter: "drop-shadow(0 0 8px rgb(201 247 58 / 0.55))" } : undefined}
    >
      <path fillRule="evenodd" fill="#c9f73a" d={MARK_FLAG_PATH} />
      <rect x="8" y="4" width="5.5" height="56" rx="2.75" fill="#c9f73a" />
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
