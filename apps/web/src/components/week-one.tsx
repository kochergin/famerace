/* The first week as a race track: five steps on one line ending at the flag.
   Done = lit; the next step pulses with its action. Replaces the single
   "next move" until the creator has crossed the whole track. */

import { LogoMark } from "@/components/logo";

export type WeekStep = { label: string; done: boolean; hint: string };

export function weekComplete(steps: WeekStep[]): boolean {
  return steps.every((s) => s.done);
}

export function WeekOne({ steps }: { steps: WeekStep[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <section className="card spotlight mt-4 p-5" style={{ "--spot": "rgb(201 247 58 / 0.1)" } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-3">
        <p className="stat text-[10px] uppercase tracking-[0.3em] text-lime">Your first week · the track</p>
        <p className="stat text-xs text-muted">
          {steps.filter((s) => s.done).length}/{steps.length}
        </p>
      </div>

      {/* the track */}
      <div className="relative mt-4 hidden sm:block">
        <div
          aria-hidden
          className="absolute left-3 right-8 top-2.5 h-px"
          style={{ background: "linear-gradient(90deg, rgb(201 247 58 / 0.6), rgb(240 195 60 / 0.5))" }}
        />
        <span aria-hidden className="absolute right-0 top-2.5 -translate-y-1/2">
          <LogoMark className="h-6 w-6" />
        </span>
        <ol className="relative grid grid-cols-5 gap-2 pr-10">
          {steps.map((step, index) => (
            <li key={step.label} className="min-w-0">
              <span
                className={`relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                  step.done
                    ? "border-lime bg-lime text-ink"
                    : index === current
                      ? "pulse-soft border-lime bg-ink text-lime"
                      : "border-edge bg-ink text-muted"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <p className={`mt-1.5 text-xs font-bold ${step.done ? "text-muted line-through" : index === current ? "text-chalk" : "text-muted"}`}>
                {step.label}
              </p>
              {index === current ? <p className="mt-0.5 text-[11px] leading-snug text-lime">{step.hint}</p> : null}
            </li>
          ))}
        </ol>
      </div>

      {/* mobile: vertical */}
      <ol className="mt-3 space-y-2 sm:hidden">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                step.done ? "border-lime bg-lime text-ink" : index === current ? "pulse-soft border-lime text-lime" : "border-edge text-muted"
              }`}
            >
              {step.done ? "✓" : index + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${step.done ? "text-muted line-through" : "text-chalk"}`}>{step.label}</span>
              {index === current ? <span className="text-xs text-lime">{step.hint}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
