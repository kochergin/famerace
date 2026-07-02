import { gradientPair } from "@/components/monogram";

/* Living backdrop: the creator's own poster art blown out and blurred behind
   their stage (album-cover energy). Falls back to their palette gradient when
   there's no photo. Parent must be relative + overflow-hidden. */
export function Backdrop({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return (
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="backdrop-art" loading="lazy" />
      </span>
    );
  }
  const [from, to] = gradientPair(name);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        opacity: 0.16,
        backgroundImage: `radial-gradient(60% 80% at 18% 0%, ${from}, transparent 60%), radial-gradient(50% 70% at 88% 12%, ${to}, transparent 60%)`,
        maskImage: "linear-gradient(to bottom, black, transparent 90%)",
      }}
    />
  );
}
