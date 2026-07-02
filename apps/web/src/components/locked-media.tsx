/* Locked media: sharp for people who unlocked it; everyone else gets a
   SERVER-blurred preview (/img/:id/blur). The sharp URL must never reach a
   locked viewer's DOM — CSS blur alone is a paywall bypass. Only /img/ paths
   have a blur variant; external URLs fall back to no preview when locked. */
export function LockedMedia({
  src,
  unlocked,
  label,
}: {
  src: string;
  unlocked: boolean;
  label: string;
}) {
  const isInternal = src.startsWith("/img/");
  if (!unlocked && !isInternal) return null;
  const shown = unlocked ? src : `${src}/blur`;
  return (
    <div className="relative mt-3 overflow-hidden rounded-lg border border-edge">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shown} alt="" loading="lazy" className="h-56 w-full object-cover" />
      {!unlocked ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center bg-ink/40 text-center">
          <span className="text-2xl">🔒</span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-chalk">{label}</span>
        </span>
      ) : null}
    </div>
  );
}
