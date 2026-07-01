import type { ReactNode } from "react";
import { copy } from "@famerace/core";

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
    FUNDED: "bg-gold/15 text-gold border border-gold/40",
    COMPLETED: "bg-gold/15 text-gold border border-gold/40",
    PAUSED: "bg-muted/15 text-muted border border-muted/40",
    SUSPENDED: "bg-velvet/40 text-chalk border border-velvet",
    REMOVED: "bg-velvet/40 text-chalk border border-velvet",
  };
  const label = status.replaceAll("_", " ");
  return <span className={`chip ${styles[status] ?? "bg-edge text-muted"}`}>{label}</span>;
}

export function FuelBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
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
