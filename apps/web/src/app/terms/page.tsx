import { config, copy } from "@famerace/core";
import { SectionTitle } from "@/components/ui";

/** Disclosures, fees and platform rules in one place (PRD §15.3, §12.2). */
export default function TermsPage() {
  const bps = (n: number) => `${(n / 100).toFixed(2)}%`;
  const pct = (n: number) => `${(n / 100).toFixed(0)}%`;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-5xl">Terms, disclosures &amp; fees</h1>
      <p className="mt-2 text-sm text-muted">
        The short, honest version. The full legal terms are finalized with counsel before public
        launch — nothing below overrides them.
      </p>

      <section className="card mt-6 p-6">
        <SectionTitle>What backing is — and is not</SectionTitle>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-chrome">
          {copy.riskDisclosure.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>No live market exists without the creator's verified consent. Draft profiles are demand signals only.</li>
          <li>Pre-launch pledges are refundable holds: they expire if the creator never claims, and you get a final confirmation window before anything is captured.</li>
          <li>All-or-nothing missions refund in full if the goal is missed by the deadline.</li>
        </ul>
      </section>

      <section className="card mt-6 p-6">
        <SectionTitle>Fees</SectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2">Revenue type</th>
              <th className="pb-2 text-right">Creator</th>
              <th className="pb-2 text-right">Platform</th>
              <th className="pb-2 text-right">Scout &amp; rewards</th>
            </tr>
          </thead>
          <tbody className="stat divide-y divide-edge text-chalk">
            <tr>
              <td className="py-2 font-sans text-chrome">Genesis Pass primary sale</td>
              <td className="text-right">{pct(config.primarySale.creatorBps)}</td>
              <td className="text-right">{pct(config.primarySale.platformBps)}</td>
              <td className="text-right">{pct(config.primarySale.scoutBps)}</td>
            </tr>
            <tr>
              <td className="py-2 font-sans text-chrome">Backstage subscription</td>
              <td className="text-right">{pct(config.backstage.creatorBps)}</td>
              <td className="text-right">{pct(config.backstage.platformBps)}</td>
              <td className="text-right">—</td>
            </tr>
            <tr>
              <td className="py-2 font-sans text-chrome">Paid drops</td>
              <td className="text-right">{pct(config.drops.creatorBps)}</td>
              <td className="text-right">{pct(config.drops.platformBps)}</td>
              <td className="text-right">{pct(config.drops.scoutBps)}</td>
            </tr>
            <tr>
              <td className="py-2 font-sans text-chrome">Tips &amp; boosts</td>
              <td className="text-right">{pct(config.tips.creatorBps)}</td>
              <td className="text-right">{pct(config.tips.platformBps)}</td>
              <td className="text-right">—</td>
            </tr>
            <tr>
              <td className="py-2 font-sans text-chrome">Paid messages &amp; requests</td>
              <td className="text-right">{pct(config.paidMessages.creatorBps)}</td>
              <td className="text-right">{pct(config.paidMessages.platformBps)}</td>
              <td className="text-right">—</td>
            </tr>
            <tr>
              <td className="py-2 font-sans text-chrome">Market trading (per trade)</td>
              <td className="text-right">{bps(config.fees.creatorFeeBps)}</td>
              <td className="text-right">{bps(config.fees.protocolFeeBps)}</td>
              <td className="text-right">{bps(config.fees.scoutFeeBps)}</td>
            </tr>
            <tr>
              <td className="py-2 font-sans text-chrome">Mission escrow release</td>
              <td className="text-right">{pct(10_000 - config.mission.platformFeeBps)}</td>
              <td className="text-right">{pct(config.mission.platformFeeBps)}</td>
              <td className="text-right">—</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card mt-6 p-6">
        <SectionTitle>Platform rules</SectionTitle>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-chrome">
          <li>18+ only. No minors as creators or in content.</li>
          <li>Prohibited everywhere: content or markets about death, injury, illness, arrest, allegations, private life, cancellation, self-harm or exploitation.</li>
          <li>Impersonating a creator is a permanent ban. Anyone can request a takedown of a draft profile about them — no account needed.</li>
          <li>Creators who receive money must include the built-in disclosure on promotional posts.</li>
          <li>Markets can be paused and payouts held during trust &amp; safety review.</li>
        </ul>
      </section>
    </div>
  );
}
