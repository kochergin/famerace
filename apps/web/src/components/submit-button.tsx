"use client";

import { useFormStatus } from "react-dom";
import { haptic, playSound } from "@/lib/sound";

/* Every action answers the instant you press it: the label swaps to a live
   pending state and the button locks. The difference between "a website"
   and "a machine that responds". Drop-in replacement for <button> inside
   any <form action={...}>. */
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} onClick={() => { haptic(); playSound("click"); }} className={`${className} disabled:cursor-wait disabled:opacity-75`}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <span className="spin-dot h-3 w-3 rounded-full border-2 border-current border-t-transparent" />
          {pendingLabel ?? "…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** YES/NO stake buttons with their own pending state (Calls). */
export function StakeButton({ side }: { side: "YES" | "NO" }) {
  const { pending } = useFormStatus();
  const tone = side === "YES" ? "bg-lime" : "bg-pink";
  return (
    <button
      type="submit"
      name="side"
      value={side}
      disabled={pending}
      onClick={() => { haptic(); playSound("click"); }}
      aria-busy={pending}
      className={`rounded ${tone} px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-ink hover:brightness-110 disabled:cursor-wait disabled:opacity-75`}
    >
      {pending ? <span className="spin-dot inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent align-middle" /> : side === "YES" ? "Yes" : "No"}
    </button>
  );
}
