// Deterministic gradient monogram — the zero-asset identity system.
// Same handle always renders the same two-color gradient, so creators are
// recognizable across every surface without uploaded media.

const PAIRS: [string, string][] = [
  ["#c9f73a", "#3d7bff"], // lime → volt
  ["#ff3d8d", "#f0c33c"], // pink → gold
  ["#3d7bff", "#ff3d8d"], // volt → pink
  ["#f0c33c", "#c9f73a"], // gold → lime
  ["#ff3d8d", "#7a1f33"], // pink → velvet
  ["#3d7bff", "#c9f73a"], // volt → lime
  ["#f0c33c", "#ff3d8d"], // gold → pink
  ["#c9f73a", "#f0c33c"], // lime → gold
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const SIZES = {
  sm: "h-8 w-8 rounded-md text-xs",
  md: "h-12 w-12 rounded-lg text-lg",
  lg: "h-16 w-16 rounded-xl text-2xl",
  xl: "h-24 w-24 rounded-2xl text-4xl",
} as const;

const RINGS = {
  live: "ring-2 ring-lime shadow-[0_0_24px_rgba(201,247,58,0.35)]",
  draft: "ring-2 ring-volt/70",
  gold: "ring-2 ring-gold shadow-[0_0_20px_rgba(240,195,60,0.3)]",
  none: "",
} as const;

export function Monogram({
  name,
  size = "md",
  ring = "none",
  className = "",
}: {
  name: string;
  size?: keyof typeof SIZES;
  ring?: keyof typeof RINGS;
  className?: string;
}) {
  const [from, to] = PAIRS[hash(name.toLowerCase()) % PAIRS.length]!;
  const initials = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={`display inline-flex shrink-0 select-none items-center justify-center text-ink ${SIZES[size]} ${RINGS[ring]} ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials || "?"}
    </span>
  );
}
