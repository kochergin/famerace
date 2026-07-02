import type { CreatorCategory } from "@famerace/db";

/* Hand-drawn category glyphs — each vertical gets its own mark (§0B: identity
   everywhere, not generic icons). Stroke-based, tint via currentColor. */

const GLYPHS: Record<CreatorCategory, { title: string; path: React.ReactNode }> = {
  MUSICIAN: {
    title: "Musician",
    path: (
      <>
        {/* waveform */}
        <path d="M2 12h2.5M7 7v10M11.5 3v18M16 8v8M20.5 11v2" strokeLinecap="round" />
      </>
    ),
  },
  INTERNET_CREATOR: {
    title: "Creator",
    path: (
      <>
        {/* play burst */}
        <path d="M9 7.5v9l8-4.5z" strokeLinejoin="round" />
        <path d="M3.5 5.5l2 2M3.5 18.5l2-2M20 3.8l-1.5 1.8M20.5 20l-1.7-1.6" strokeLinecap="round" />
      </>
    ),
  },
  BUILDER_FOUNDER: {
    title: "Builder",
    path: (
      <>
        {/* rocket */}
        <path d="M12 3c3 2.2 4.2 5.6 4.2 8.8L12 16l-4.2-4.2C7.8 8.6 9 5.2 12 3z" strokeLinejoin="round" />
        <path d="M12 16v4.5M8.4 14.5l-3 1.6 2-3.8M15.6 14.5l3 1.6-2-3.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="9.5" r="1.6" />
      </>
    ),
  },
  ARTIST_DESIGNER: {
    title: "Artist",
    path: (
      <>
        {/* brush stroke */}
        <path d="M4 20c.5-3 1.5-4.3 3.4-4.6L19 4.6a1.8 1.8 0 0 1 2.5 2.5L10.6 18.6C10.3 20.5 9 21.5 6 22z" strokeLinejoin="round" />
        <path d="M14.5 7.5l2 2" strokeLinecap="round" />
      </>
    ),
  },
};

export function CategoryGlyph({
  category,
  className = "h-4 w-4",
}: {
  category: CreatorCategory;
  className?: string;
}) {
  const glyph = GLYPHS[category];
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      role="img"
      aria-label={glyph.title}
    >
      {glyph.path}
    </svg>
  );
}
