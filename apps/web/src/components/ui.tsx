import type { ReactNode } from "react";
import { copy } from "@famerace/core";
import { EmptyStage } from "@/components/stage";

/** Status chip with the Electric Backstage status colors (PRD §0B.3). */
export function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-volt/15 text-volt border border-volt/40",
    UNCLAIMED: "bg-volt/15 text-volt border border-volt/40",
    CLAIM_STARTED: "bg-chrome/10 text-chrome border border-chrome/30",
    VERIFICATION_PENDING: "bg-chrome/10 text-chrome border border-chrome/30",
    APPROVED: "bg-lime/10 text-lime border border-lime/30",
    LAUNCHING_SOON: "bg-lime/15 text-lime border border-lime/40",
    LIVE: "bg-lime text-ink",
    TRENDING: "bg-pink/15 text-pink border border-pink/40",
    GRADUATION: "bg-gold/15 text-gold border border-gold/40",
    MATURE: "bg-chrome/15 text-chrome border border-chrome/40",
    FUNDED: "bg-gold/15 text-gold border border-gold/40",
    COMPLETED: "bg-gold/15 text-gold border border-gold/40",
    PAUSED: "bg-muted/15 text-muted border border-muted/40",
    SUSPENDED: "bg-velvet/40 text-chalk border border-velvet",
    REMOVED: "bg-velvet/40 text-chalk border border-velvet",
  };
  const label = status.replaceAll("_", " ");
  return <span className={`chip ${styles[status] ?? "bg-edge text-muted"}`}>{label}</span>;
}

export function FuelBar({ value, max }: { value: number | bigint; max: number | bigint }) {
  const v = Number(value);
  const m = Number(max);
  const pct = m > 0 ? Math.min(100, Math.round((v / m) * 100)) : 0;
  return (
    <div className="fuel">
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div>
      <div className={`stat text-lg font-bold ${accent ?? "text-chalk"}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

/**
 * Mandatory risk disclosure (PRD §15.3). The confirm button is part of this
 * component so no purchase flow can render a confirm without the disclosure.
 */
export function RiskDisclosure({
  confirmLabel,
  feeLine,
  disabled,
}: {
  confirmLabel: string;
  feeLine?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded border border-edge bg-ink/60 p-3 text-xs leading-relaxed text-muted">
        {copy.riskDisclosure.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {feeLine ? <p className="mt-1 text-chrome">{feeLine}</p> : null}
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink transition hover:brightness-110 disabled:opacity-40"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 px-6 py-10 text-center">
      <EmptyStage className="mb-3" />
      <p className="display text-xl text-muted">{title}</p>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="display text-2xl text-chalk">{children}</h2>
      {right}
    </div>
  );
}

const BANNER_TONES = {
  lime: "border-lime/30 bg-lime/5 text-lime",
  chrome: "border-chrome/30 bg-chrome/5 text-chrome",
  gold: "border-gold/40 bg-gold/10 text-gold",
  pink: "border-pink/40 bg-pink/10 text-pink",
} as const;

export function Banner({ tone, children }: { tone: keyof typeof BANNER_TONES; children: ReactNode }) {
  return <p className={`feed-in mb-4 rounded border px-3 py-2 text-sm ${BANNER_TONES[tone]}`}>{children}</p>;
}

const SECTION_ACCENTS = {
  lime: "border-t-lime/60 [--spot:rgb(201_247_58/0.08)]",
  gold: "border-t-gold/60 [--spot:rgb(240_195_60/0.08)]",
  volt: "border-t-volt/60 [--spot:rgb(61_123_255/0.08)]",
  pink: "border-t-pink/60 [--spot:rgb(255_61_141/0.08)]",
  velvet: "border-t-velvet [--spot:rgb(122_31_51/0.22)]",
  none: "",
} as const;

/** Section card with a colored accent edge — gives each product surface its
 *  own identity (market=lime, missions=gold, backstage=velvet…). */
export function SectionCard({
  accent = "none",
  className = "",
  children,
}: {
  accent?: keyof typeof SECTION_ACCENTS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`card spotlight mt-6 border-t-2 p-6 ${SECTION_ACCENTS[accent]} ${className}`}
    >
      {children}
    </section>
  );
}

/** Radial score gauge — the Taste Score hero (§0A.15: taste is the flex). */
export function Gauge({ score, label, sub }: { score: number; label: string; sub?: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <div className="relative inline-flex h-36 w-36 items-center justify-center">
      <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--color-edge)" strokeWidth="9" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--color-lime)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          style={{ filter: "drop-shadow(0 0 8px rgb(201 247 58 / 0.5))" }}
        />
      </svg>
      <div className="text-center">
        <div className="display text-4xl text-lime">{score}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
        {sub ? <div className="stat text-[10px] text-chrome">{sub}</div> : null}
      </div>
    </div>
  );
}
