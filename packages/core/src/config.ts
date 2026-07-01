// Season / platform configuration with env overrides.
// PRD §0A.5: launch thresholds are per-season configuration, not constants.

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  season: {
    name: "Genesis Season",
    requiredBackers: intEnv("LAUNCH_REQUIRED_BACKERS", 250),
    requiredDemandCents: intEnv("LAUNCH_REQUIRED_DEMAND_CENTS", 1_000_000),
    requiredPerksCount: 3,
    maxLaunchesPerDay: 5,
  },
  /** Back-tier amounts in cents (PRD §0B.8: $25 / $100 / $500). */
  backTiersCents: [2_500, 10_000, 50_000] as const,
  /** Fee splits in basis points of gross (PRD §12.2 secondary trading row). */
  fees: {
    creatorFeeBps: 35, // 0.35%
    protocolFeeBps: 65, // 0.65%
    scoutFeeBps: 10, // 0.10%
  },
  /** Genesis wall size (PRD §0B.7: "first 500 Genesis Backers"). */
  genesisWallSize: 500,
  /** Demand order lifetime before expiry. */
  demandOrderTtlDays: 30,
  /** Confirmation window length before opening auction (PRD §0A.4: 24–48h). */
  confirmationWindowHours: 24,
  /**
   * Market graduation gates (PRD §9.6 stages, §0A.7.5): GENESIS_CURVE →
   * GRADUATION at tier 1, GRADUATION → MATURE at tier 2 (sweep-checked).
   */
  graduation: {
    volumeCents: intEnv("GRADUATION_VOLUME_CENTS", 25_000_000), // $250k traded
    holderCount: intEnv("GRADUATION_HOLDERS", 100),
    matureVolumeCents: intEnv("MATURE_VOLUME_CENTS", 250_000_000), // $2.5M traded
    matureHolderCount: intEnv("MATURE_HOLDERS", 1_000),
  },
  /** Anti-bot: max buys per user per market within the launch window. */
  antiBot: {
    launchWindowMinutes: 30,
    maxBuysInLaunchWindow: 5,
    maxUnitsPerLaunchBuy: 10_000,
  },
  /** Primary-sale split (PRD §12.2: Genesis Pass 80/12/8). */
  primarySale: {
    creatorBps: 8_000,
    platformBps: 1_200,
    scoutBps: 800,
  },
  /** Mission contributions settle 100% into escrow; platform fee on release. */
  mission: {
    platformFeeBps: 500, // 5% on escrow release
    nearFundingThreshold: 0.9,
  },
  backstage: {
    creatorBps: 8_500, // 85% (PRD §12.2)
    platformBps: 1_500,
  },
  drops: {
    creatorBps: 8_500,
    platformBps: 1_000,
    scoutBps: 500,
  },
  tips: {
    creatorBps: 9_000,
    platformBps: 1_000,
  },
  paidMessages: {
    creatorBps: 8_000,
    platformBps: 2_000,
  },
} as const;

export type FameraceConfig = typeof config;
