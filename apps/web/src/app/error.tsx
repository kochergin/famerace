"use client";

/* Runtime error boundary — technical difficulties, stay in character.
   Client component per Next contract; reset() re-renders the segment. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="relative mx-auto max-w-xl overflow-x-clip py-24 text-center">
      <span aria-hidden className="beam beam-pink beam-a left-[10%]" />
      <span aria-hidden className="beam beam-b right-[10%]" />
      <p className="stat text-xs uppercase tracking-[0.35em] text-pink">Technical difficulties</p>
      <h1 className="display mt-3 text-5xl leading-tight sm:text-6xl">
        Even the best shows
        <br />
        drop a mic.
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
        Something backstage just failed. Nothing you did — run it back and the crew will have it up again.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.3)] transition hover:brightness-110"
        >
          Run it back
        </button>
        <a
          href="/"
          className="rounded border border-edge px-6 py-3 font-bold uppercase tracking-wide text-chalk transition hover:border-lime"
        >
          Back to the show
        </a>
      </div>
    </div>
  );
}
