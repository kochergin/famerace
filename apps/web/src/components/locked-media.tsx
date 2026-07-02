/* Locked media: sharp for people who unlocked it, a heavy blur with a lock
   for everyone else — the tease IS the conversion surface. */
export function LockedMedia({
  src,
  unlocked,
  label,
}: {
  src: string;
  unlocked: boolean;
  label: string;
}) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-lg border border-edge">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`h-56 w-full object-cover ${unlocked ? "" : "scale-110 blur-2xl"}`}
      />
      {!unlocked ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center bg-ink/40 text-center">
          <span className="text-2xl">🔒</span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-chalk">{label}</span>
        </span>
      ) : null}
    </div>
  );
}
