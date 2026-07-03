import Link from "next/link";
import { LogoMark } from "@/components/logo";

/* 404 — the wrong stage door. Even dead ends stay in character. */
export default function NotFound() {
  return (
    <div className="relative mx-auto max-w-xl overflow-x-clip py-24 text-center">
      <span aria-hidden className="beam beam-a left-[10%]" />
      <span aria-hidden className="beam beam-pink beam-b right-[10%]" />
      <LogoMark className="mx-auto h-12 w-12 opacity-50 grayscale" />
      <p className="stat mt-6 text-xs uppercase tracking-[0.35em] text-muted">404 · wrong stage door</p>
      <h1 className="display mt-3 text-5xl leading-tight sm:text-6xl">
        This page isn&apos;t
        <br />
        in the lineup.
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
        Whatever was here got cut from the show. The race is out front — and the board never stops.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.3)] transition hover:brightness-110"
        >
          Back to the show
        </Link>
        <Link
          href="/draft"
          className="rounded border border-edge px-6 py-3 font-bold uppercase tracking-wide text-chalk transition hover:border-lime"
        >
          Open the board
        </Link>
      </div>
    </div>
  );
}
