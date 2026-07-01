// Copy bank — the single source of user-facing language (PRD §1.3/§1.4, §0B.8).
// scripts/copylint.mjs scans UI source for banned investment language;
// canonical phrasing lives here so flows can't drift into unsafe framing.

export const copy = {
  tagline: "Back the rise.",
  oneLiner:
    "The internet's talent draft — discover, fund and back rising creators before the world notices.",
  heroLines: [
    "Find them early.",
    "Back their rise.",
    "Prove your taste.",
  ],
  cta: {
    back: (name: string) => `Back ${name}`,
    becomeGenesisBacker: "Become a Genesis Backer",
    fundMission: "Fund the next move",
    joinBackstage: "Join Backstage",
    invite: (name: string) => `Invite ${name}`,
    addToRoster: "Add to Roster",
    pledgeIfClaimed: "Pledge if claimed",
    claimProfile: "Claim your FameRace launch",
  },
  /**
   * Mandatory risk disclosure (PRD §15.3). Rendered by the RiskDisclosure
   * component that wraps every purchase confirm button.
   */
  riskDisclosure: [
    "This is not equity, debt, revenue share or ownership of the creator.",
    "The price of access/status tokens can go down as well as up.",
    "The creator may stop posting. Perks are subject to the terms of service.",
    "Missions carry fulfillment risk. See the refund policy before contributing.",
  ],
  feeDisclosure: (creatorBps: number, protocolBps: number, scoutBps: number) =>
    `Fees: ${(creatorBps / 100).toFixed(2)}% creator · ${(protocolBps / 100).toFixed(2)}% platform · ${(scoutBps / 100).toFixed(2)}% scout & rewards`,
  creatorDisclosure:
    "#ad / paid partnership — I may earn from fan purchases and platform activity.",
  draftNotice:
    "This is a fan-created draft profile — a demand signal, not an endorsement. No trading happens until the creator claims and verifies.",
  footerLegal:
    "Access and status tokens on FameRace are not equity, debt, revenue share or ownership of any creator. Prices can go down. See terms for details.",
} as const;

/**
 * Banned terms (PRD §1.3, §15A.5). CI fails if these appear in UI copy.
 * Kept here so the lint rule and the product share one list.
 */
export const BANNED_COPY_TERMS = [
  "invest in",
  "buy human",
  "human stock",
  "human token",
  "own a piece",
  "profit from",
  "guaranteed upside",
  "revenue share",
  "bet on their life",
  "tokenized fame",
] as const;
