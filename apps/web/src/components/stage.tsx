/* Decorative stage scenery (server-rendered, zero JS). Deterministic math
   only — no Math.random, so server and client HTML always match. */

/** Two swaying spotlight beams + floating dust, for hero sections. */
export function StageLights() {
  const dust = Array.from({ length: 9 }, (_, i) => ({
    left: `${8 + ((i * 37 + 13) % 84)}%`,
    bottom: `${6 + ((i * 23) % 40)}%`,
    delay: `${(i * 0.9) % 7}s`,
    duration: `${5.5 + (i % 4)}s`,
    pink: i % 3 === 2,
  }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="beam beam-a left-[6%]" />
      <span className="beam beam-pink beam-b right-[6%]" />
      {dust.map((d, i) => (
        <span
          key={i}
          className="dust"
          style={{
            left: d.left,
            bottom: d.bottom,
            animationDelay: d.delay,
            animationDuration: d.duration,
            background: d.pink ? "rgb(255 61 141 / 0.6)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** Crowd silhouette along the bottom edge of the hero — the audience is here. */
export function Crowd({ className = "" }: { className?: string }) {
  // Deterministic skyline of heads + a few raised arms/phones.
  const heads = Array.from({ length: 26 }, (_, i) => {
    const x = 10 + i * 47 + ((i * 29) % 17);
    const r = 20 + ((i * 13) % 12);
    const y = 96 - ((i * 7) % 14);
    return { x, r, y };
  });
  const arms = [3, 8, 14, 19, 24].map((i) => ({
    x: 22 + i * 47,
    h: 34 + ((i * 11) % 14),
  }));
  return (
    <svg
      aria-hidden
      viewBox="0 0 1240 110"
      preserveAspectRatio="xMidYMax slice"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full sm:h-24 ${className}`}
    >
      {arms.map((a, i) => (
        <g key={`arm-${i}`} fill="rgb(6 6 9 / 0.92)">
          <rect x={a.x - 3} y={96 - a.h - 26} width="7" height={a.h} rx="3.5" transform={`rotate(${i % 2 === 0 ? -12 : 9} ${a.x} ${96 - 26})`} />
          <rect x={a.x - 7} y={96 - a.h - 40} width="14" height="20" rx="3" transform={`rotate(${i % 2 === 0 ? -12 : 9} ${a.x} ${96 - 26})`} fill="rgb(201 247 58 / 0.2)" />
        </g>
      ))}
      {heads.map((h, i) => (
        <circle key={i} cx={h.x} cy={h.y} r={h.r} fill="rgb(6 6 9 / 0.95)" />
      ))}
      <rect x="0" y="88" width="1240" height="22" fill="rgb(6 6 9 / 0.98)" />
    </svg>
  );
}

/** Empty-stage illustration for empty states: one spotlight, no star — yet. */
export function EmptyStage({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 160 90" className={`mx-auto ${className}`} width="160" height="90">
      <polygon points="66,0 94,0 128,78 32,78" fill="rgb(201 247 58 / 0.09)" />
      <ellipse cx="80" cy="78" rx="46" ry="7" fill="rgb(201 247 58 / 0.14)" />
      <circle cx="80" cy="6" r="5" fill="rgb(201 247 58 / 0.5)" />
      <ellipse cx="80" cy="78" rx="14" ry="2.5" fill="rgb(244 244 240 / 0.18)" />
      <text x="80" y="70" textAnchor="middle" fontSize="9" fill="rgb(244 244 240 / 0.35)" fontFamily="var(--font-mono)">
        ?
      </text>
    </svg>
  );
}
