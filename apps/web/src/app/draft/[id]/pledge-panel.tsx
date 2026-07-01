import { config, copy } from "@famerace/core";
import type { DraftProfile } from "@famerace/db";
import { money } from "@/lib/format";

/**
 * Demand Vault panel (PRD §0A.3). Phase 2 wires these tiers to Fan Demand
 * Orders; until then the tiers render as a disabled preview.
 */
export function PledgePanel({ profile, signedIn }: { profile: DraftProfile; signedIn: boolean }) {
  void profile;
  void signedIn;
  return (
    <section className="card mt-6 p-6">
      <h2 className="display text-2xl">{copy.cta.pledgeIfClaimed}</h2>
      <p className="mt-1 text-sm text-muted">
        Demand collected here waits in the vault. Money never moves to the creator before an official,
        verified launch — unclaimed pledges expire or refund.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {config.backTiersCents.map((cents) => (
          <button
            key={cents}
            disabled
            className="rounded border border-edge px-4 py-2 text-sm font-bold uppercase tracking-wide text-muted opacity-60"
          >
            {money(cents)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">The Demand Vault opens with the next release.</p>
    </section>
  );
}
