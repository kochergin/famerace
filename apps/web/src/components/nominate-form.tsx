"use client";

import { useState } from "react";
import { FormError } from "@/components/form-error";
import { Monogram } from "@/components/monogram";
import { SubmitButton } from "@/components/submit-button";
import { CATEGORY_LABELS } from "@/lib/format";

/* Filing a scout report, not filling a form: the draft-board card you're
   creating assembles at the top while you type, and the thesis meter fills
   toward "on the record". Draft profiles stay monograms by design (consent —
   no photos until the person claims). */

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-chalk placeholder:text-muted focus:border-volt focus:outline-none";

const THESIS_MIN = 20;

export function NominateForm({
  action,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [thesis, setThesis] = useState("");
  const empty = !name && !thesis;
  const thesisPct = Math.min(100, Math.round((thesis.length / THESIS_MIN) * 100));

  return (
    <div>
      {/* The card you're putting on the board */}
      <div
        className={`card relative overflow-hidden p-5 transition-colors ${empty ? "border-dashed" : "border-volt/40"}`}
        style={{ "--spot": "rgb(61 123 255 / 0.12)" } as React.CSSProperties}
      >
        <div className="flex items-center justify-between">
          <span className="stat text-[10px] uppercase tracking-[0.3em] text-volt">
            #?? draft · incoming
          </span>
          <span className="chip border border-dashed border-volt/40 text-volt">Unclaimed</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          {name ? (
            <Monogram name={name} size="lg" ring="draft" />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-edge text-xl text-muted">
              ?
            </span>
          )}
          <div className="min-w-0">
            <p className={`display truncate text-3xl leading-none ${name ? "text-chalk" : "text-muted/60"}`}>
              {name || "Who did you find?"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {category ? CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] : "category"} · nominated by you
            </p>
          </div>
        </div>
        <p className={`mt-3 text-sm ${thesis ? "text-chalk" : "text-muted/60"}`}>
          “{thesis || "Your scout thesis shows here — why are they about to break out?"}”
        </p>
      </div>

      <form action={action} className="mt-5 space-y-3">
        <FormError error={error} />
        <input
          name="nameOrHandle"
          placeholder="Name or @handle"
          required
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input name="externalLink" type="url" placeholder="Link to their public profile (optional)" className={inputClass} />
        <select
          name="category"
          required
          className={inputClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="" disabled>
            Category
          </option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <div>
          <textarea
            name="thesis"
            placeholder="Scout thesis — why are they about to break out? (this shows on the profile)"
            required
            minLength={THESIS_MIN}
            rows={4}
            className={inputClass}
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
          />
          <div className="mt-1.5 flex items-center gap-2" aria-hidden>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-edge">
              <span
                className={`block h-full rounded-full transition-all ${thesisPct >= 100 ? "bg-volt" : "bg-edge brightness-150"}`}
                style={{ width: `${thesisPct}%` }}
              />
            </span>
            <span className={`stat text-[10px] uppercase tracking-widest ${thesisPct >= 100 ? "text-volt" : "text-muted"}`}>
              {thesisPct >= 100 ? "On the record" : `${thesis.length}/${THESIS_MIN}`}
            </span>
          </div>
        </div>
        <input
          name="requestedMission"
          placeholder="Mission you want to fund (e.g. First Music Video)"
          className={inputClass}
        />
        <SubmitButton
          pendingLabel="Drafting them…"
          className="w-full rounded bg-volt px-4 py-3 font-bold uppercase tracking-wide text-chalk hover:brightness-110"
        >
          Add to the Draft
        </SubmitButton>
        <p className="text-xs text-muted">
          Prohibited: minors, private persons, and anything on the prohibited-categories list.
          Nominations are reviewed before appearing on the public board.
        </p>
      </form>
    </div>
  );
}
