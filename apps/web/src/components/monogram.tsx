import type { CSSProperties } from "react";

// The identity system. Every name hashes to a fixed two-color gradient pair:
// with no photo that pair renders as a gradient monogram; with a photo it
// becomes a duotone poster treatment over the image (see .face in globals.css),
// so uploaded faces are automatically art-directed into the same palette.
// Draft profiles never pass a src — unclaimed people stay monograms (consent).

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

/** The gradient pair a given name resolves to (shared with upload previews). */
export function gradientPair(name: string): [string, string] {
  return PAIRS[hash(name.toLowerCase()) % PAIRS.length]!;
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

/** view-transition-name must be a CSS ident — normalize handles/usernames. */
function morphName(key: string): string {
  return `face-${key.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

export function Monogram({
  name,
  src,
  size = "md",
  ring = "none",
  morph,
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  ring?: keyof typeof RINGS;
  /** Shared-element morph key (usually the handle). Use at most once per
      surface per key — duplicate names cancel the whole view transition. */
  morph?: string;
  className?: string;
}) {
  const [from, to] = gradientPair(name);
  const style: CSSProperties = morph ? { viewTransitionName: morphName(morph) } : {};
  const gradient = `linear-gradient(135deg, ${from}, ${to})`;

  if (src) {
    return (
      <span aria-hidden className={`face inline-flex shrink-0 ${SIZES[size]} ${RINGS[ring]} ${className}`} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" />
        <span className="face-tone face-tone-screen" style={{ backgroundImage: gradient }} />
        <span className="face-tone face-tone-multiply" style={{ backgroundImage: gradient }} />
        <span className="face-lines" />
      </span>
    );
  }

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
      style={{ ...style, backgroundImage: gradient }}
    >
      {initials || "?"}
    </span>
  );
}
