import Link from "next/link";
import { copy } from "@famerace/core";

export default function HomePage() {
  return (
    <div className="py-16 text-center">
      <p className="chip bg-lime/10 text-lime border border-lime/30">Genesis Draft</p>
      <h1 className="display mx-auto mt-4 max-w-3xl text-6xl md:text-7xl">
        100 Future Stars. 30 Days. The Internet Decides.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{copy.oneLiner}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/draft"
          className="rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110"
        >
          Open the Draft Board
        </Link>
        <Link
          href="/join"
          className="rounded border border-edge px-6 py-3 font-bold uppercase tracking-wide text-chalk hover:border-lime"
        >
          Join
        </Link>
      </div>
    </div>
  );
}
