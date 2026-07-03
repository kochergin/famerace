"use client";

import Link from "next/link";
import { useState } from "react";
import { FormError } from "@/components/form-error";
import { Monogram } from "@/components/monogram";
import { SubmitButton } from "@/components/submit-button";
import { TiltCard } from "@/components/tilt-card";
import { CATEGORY_LABELS } from "@/lib/format";

/* "Launch my race": the self-serve door for creators who bring their own
   audience. The launch page assembles live while they type — the same magic
   as the fan rookie card, pointed the other way. */

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-chalk placeholder:text-muted focus:border-lime focus:outline-none";

export function LaunchRace({
  action,
  signedIn,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  signedIn: boolean;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [thesis, setThesis] = useState("");
  const ticker = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase();

  return (
    <div className="grid items-start gap-8 md:grid-cols-2">
      {/* The page you're about to own, building itself */}
      <TiltCard>
        <div
          className={`card relative overflow-hidden p-5 transition-colors ${name ? "border-lime/40" : "border-dashed"}`}
          style={{ "--glow": "rgb(201 247 58 / 0.25)" } as React.CSSProperties}
        >
          <div className="flex items-center justify-between">
            <span className="stat text-[10px] uppercase tracking-[0.3em] text-muted">
              famerace.fun/{name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) : "you"}
            </span>
            <span className="chip bg-lime text-ink">LIVE</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            {name ? (
              <Monogram name={name} size="lg" ring="live" />
            ) : (
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-edge text-xl text-muted">
                ?
              </span>
            )}
            <div className="min-w-0">
              <p className={`display truncate text-3xl leading-none ${name ? "text-chalk" : "text-muted/60"}`}>
                {name || "Your name"}
              </p>
              <p className="stat mt-1 text-sm text-lime">
                ${ticker || "TICKER"}{category ? ` · ${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}` : ""}
              </p>
            </div>
          </div>
          <p className={`mt-3 text-sm ${thesis ? "text-chalk" : "text-muted/60"}`}>
            “{thesis || "Your story — why now is the moment to back you."}”
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-edge pt-3 text-center">
            <div>
              <p className="stat text-lg font-bold text-lime">$0→</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">Advance</p>
            </div>
            <div>
              <p className="stat text-lg font-bold text-chalk">0.35%</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">Every trade</p>
            </div>
            <div>
              <p className="stat text-lg font-bold text-gold">100%</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">Yours</p>
            </div>
          </div>
        </div>
      </TiltCard>

      <div>
        <form action={action} className="space-y-3">
          <FormError error={error} />
          <input
            name="nameOrHandle"
            placeholder="Your name or @handle"
            required
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            name="category"
            required
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="" disabled>
              What do you make?
            </option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            name="thesis"
            placeholder="Your story in two lines — why now is the moment (shows on your page)"
            required
            minLength={20}
            rows={3}
            className={inputClass}
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
          />
          <input name="externalLink" type="url" placeholder="Link to your main profile (TikTok, IG, YouTube…)" className={inputClass} />
          {signedIn ? (
            <SubmitButton
              pendingLabel="Opening your race…"
              className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.3)] hover:brightness-110"
            >
              Launch my race →
            </SubmitButton>
          ) : (
            <Link
              href="/join"
              className="block w-full rounded bg-lime px-4 py-3 text-center font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.3)] transition hover:brightness-110"
            >
              Create your account first — 30 seconds →
            </Link>
          )}
          <p className="text-[11px] text-muted">
            If fans already drafted you, you claim that page — and every dollar waiting on it.
          </p>
        </form>
      </div>
    </div>
  );
}
