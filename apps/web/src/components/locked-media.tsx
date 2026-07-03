/* Locked media: sharp for people who unlocked it; everyone else gets a
   SERVER-blurred preview (/img/:id/blur). The sharp URL must never reach a
   locked viewer's DOM — CSS blur alone is a paywall bypass. Video/audio
   renders a real player when unlocked; locked A/V shows a dark stage door
   (no blur variant exists for streams, and none is needed: the tease is
   the title). */
export function LockedMedia({
  src,
  unlocked,
  label,
  mime,
}: {
  src: string;
  unlocked: boolean;
  label: string;
  mime?: string;
}) {
  const isInternal = src.startsWith("/img/");
  const isVideo = mime?.startsWith("video/") ?? false;
  const isAudio = mime?.startsWith("audio/") ?? false;

  if (unlocked && isVideo) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-edge bg-ink">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={src} controls preload="metadata" className="max-h-96 w-full" />
      </div>
    );
  }
  if (unlocked && isAudio) {
    return (
      <div className="mt-3 rounded-lg border border-edge bg-ink p-3">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={src} controls preload="metadata" className="w-full" />
      </div>
    );
  }
  if (!unlocked && (isVideo || isAudio)) {
    return (
      <div className="relative mt-3 flex h-40 flex-col items-center justify-center overflow-hidden rounded-lg border border-edge bg-ink">
        <span aria-hidden className="beam beam-a left-[20%] opacity-40" />
        <span className="text-2xl">🔒</span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-chalk">{label}</span>
        <span className="stat mt-0.5 text-[10px] uppercase tracking-widest text-muted">
          {isVideo ? "video" : "audio"} · members hear it first
        </span>
      </div>
    );
  }

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
