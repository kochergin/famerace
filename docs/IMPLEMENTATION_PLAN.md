# FameRace V1 — Engineering Implementation Plan

**Scope:** FameRace V1 "Genesis Draft" as defined in [PRD.md](PRD.md) §0A.19, §5, §8–§9A.
**Companion docs:** [DATA_MODEL.md](DATA_MODEL.md) (schema), [BACKLOG.md](BACKLOG.md) (P0 stories).
**All `§` references point to [PRD.md](PRD.md).**

---

## 1. Tech stack

The PRD (§16.1) calls for "Next.js or equivalent" with server-rendered public pages, realtime feeds, share-card image generation and payment/wallet abstraction.

| Layer | Choice | Rationale |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript** | Server-rendered public creator/draft pages for SEO and social sharing (§16.1); one deployable covers public site, creator dashboard and admin at V1. |
| Database | **PostgreSQL + Prisma** | The domain is heavily stateful — creator lifecycle, market stages, mission states, demand-order lifecycle are all explicit state machines (§9.2, §9.6, §9.12, §9A.3). A relational schema with enum-backed status columns and audited transitions fits far better than a document store. |
| Cache / realtime / queues | **Redis** | Live Launch Feed pub/sub (§9A.11), background job queues (Fame Score recompute, notifications, share-card rendering, auction clearing), rate limiting and anti-bot counters (§9.6). |
| Background jobs | **BullMQ workers** (same codebase, separate process) | Score computation, feed fan-out, notification dispatch, auction settlement, payout batching. |
| Styling / design system | **Tailwind CSS + design tokens** | Encodes the "Electric Backstage" system (§0B.3–§0B.4): deep black/graphite base, electric lime / hot pink / electric blue / chrome accents, tabular-mono numerals, poster-style headings. |
| Share cards | **Satori / `@vercel/og`** server-side image generation | §9A.12 requires dynamic, branded, platform-aspect-ratio images with deep links; satori renders JSX → PNG server-side with no headless browser. |
| Payments | **Payments abstraction interface**; Stripe (cards) first, embedded-wallet/stablecoin provider (e.g. Privy + USDC) second | §16.4 requires cards + stablecoins + refunds + escrow. An internal `PaymentProvider` interface keeps flows (pledge authorization, mission escrow, subscription billing, payouts, refunds) provider-agnostic. |
| Market ledger | **Off-chain double-entry ledger first**; on-chain contracts deferred | §16.3 requires audited contracts "before scale" and a clear custody model. V1 runs the bonding curve and holdings on a custodial, append-only Postgres ledger with full transaction history and admin pause. On-chain migration is a post-V1 milestone and is isolated behind the market module's interface. |
| Auth | **Auth.js (email magic link + OAuth) with wallet-login adapter** | §9.1 requires email, social and wallet login plus an embedded-wallet option. |
| Observability | Structured logging + audit log table + error tracking | §9.21 requires audit logs; trust/safety and payout reviews need traceability. |

### Monorepo layout

Modular monolith — the 14 "services" of §16.2 become domain modules behind one API layer. Split into real services only when scale demands it.

```
famerace/
├── apps/
│   └── web/                  # Next.js: public site, creator dashboard, admin, API routes
├── packages/
│   ├── db/                   # Prisma schema, migrations, seed
│   ├── core/                 # Domain modules (see §2 below)
│   ├── ui/                   # Electric Backstage component library + design tokens
│   ├── cards/                # Share-card templates + satori renderer
│   └── config/               # Shared eslint/tsconfig, copy-lint rules
├── workers/                  # BullMQ processors (scores, feed, notifications, auctions, payouts)
└── docs/
```

---

## 2. Architecture

```
                ┌───────────────────────────────────────────────┐
                │                 apps/web (Next.js)             │
                │  Public surfaces │ Creator dashboard │ Admin   │
                └───────┬───────────────────┬───────────────────┘
                        │ server actions / API routes
                ┌───────▼───────────────────▼───────────────────┐
                │              packages/core (domain)            │
                │ users · creators · draft · demand · launch     │
                │ market · missions · backstage · streetteam     │
                │ scores · roster · crews · feed · cards         │
                │ notifications · moderation · payments · payouts│
                └───────┬───────────────────┬───────────────────┘
                        │                   │
                 ┌──────▼──────┐     ┌──────▼──────┐
                 │  PostgreSQL │     │    Redis     │──► workers/ (BullMQ)
                 │  (Prisma)   │     │ pub/sub·jobs │
                 └─────────────┘     └─────────────┘
```

Key decisions:

- **State machines are first-class.** Every lifecycle in the PRD is implemented as an explicit transition function with an allowed-transitions table, actor authorization and an audit-log entry per transition. Lifecycles: creator status (§9.2), market stages (§9.6), mission states (§9.12), demand orders (§9A.3), launch threshold (§9A.4), quests (§9.13). Enums are specified in [DATA_MODEL.md](DATA_MODEL.md).
- **Realtime Live Launch Feed** (§9A.11): domain modules emit typed events to an `Event` table (source of truth) and Redis pub/sub (fan-out); the client consumes an SSE endpoint. Feed survives Redis restarts because the table is authoritative.
- **The consent gate is structural, not cosmetic** (§15.1, §9A.2): market, price, token and monetization modules are only reachable from a `Creator` record with status `LIVE`/`LAUNCHING_SOON`. `DraftProfile` is a separate entity with no relation to markets at the type level, so an unclaimed profile *cannot* render trading UI.
- **Money paths are double-entry.** All value movement (pledges, auction fills, curve trades, mission escrow, subscriptions, drops, tips, payouts, refunds, match funds) writes balanced ledger entries. Fee splits (§12.2) are configuration, not hard-coded arithmetic.

---

## 3. Phased build plan

Each phase ships a coherent, demoable slice and maps to PRD modules. Stories per phase are in [BACKLOG.md](BACKLOG.md).

### Phase 0 — Foundation
Repo scaffold (monorepo, CI, lint/typecheck/test pipeline), Prisma schema baseline, Auth.js with email + social login and wallet-adapter stub, user accounts and public profiles (username, avatar, badges shell), roles (backer / scout / creator / admin), referral tracking, notification settings, Electric Backstage token set and base UI kit. *(§9.1, §0B)*

### Phase 1 — Draft layer (pre-market virality)
Draft Board with category filters and demand-ranked list (§9A.1); Draft Profiles as unclaimed stubs enforcing the §9A.2 must-not-include rules (no price, token, market cap, trading, implied endorsement); Scout nominations with thesis, duplicate detection and moderation queue (§9.3); invite links with scout attribution; takedown request flow (§15.9). **Exit criterion:** the D-21 "public Draft opens" moment (§13A) is fully supportable.

### Phase 2 — Demand & claim
Fan Demand Orders — the four intent types (Genesis Pass / mission pledge / market buy / Backstage) as non-binding intents first, refundable card pre-authorizations second (§0A.3, §9A.3); Demand Vault aggregation on draft profiles; Creator Claim Flow — claim link, social verification, KYC hook, category selection, payout setup, terms + disclosures (§9.2); Launch Threshold Engine evaluating the §0A.5 gate (verified, 250 backers, $10k demand, mission + perks configured, T&S approved) with `NOT_READY → ALMOST_READY → THRESHOLD_MET → LAUNCHING_SOON → LIVE`; Claim Bounty with anti-spam rules and scout payout logic (§9A.6). **Exit criterion:** the "You already have 1,842 fans and $47k waiting" creator-acquisition message is real data.

### Phase 3 — Launch & market
Launching Soon page with countdown and confirmation window (§0A.4); Opening Batch Auction — order collection, single-clearing allocation, failed-payment/refund handling, Genesis badge + Backer Wall assignment, transition to live curve (§9A.5); Genesis Pass / Fame Token issuance framed strictly as access/status/utility (§9.5); bonding-curve market — buy/sell ("Back") flow with plain-language price-impact display, fee display (creator/protocol/scout splits per §12.2), holders, volume, transaction history, anti-bot controls, admin pause (§9.6); Stripe integration live behind the payments interface. **Exit criterion:** a verified creator can go from threshold-met to live trading with a fair opening.

### Phase 4 — Monetization & missions
Missions — full field set and state machine, escrow holds, proof requirements, update schedule, refund/threshold rules, Match Fund eligibility hooks (§9.12, §9A.10); Backstage — subscription tiers, locked feed with previews, holder-gated access, monthly billing, cancellation (§9.7); Paid Drops with previews, access rules and quantity limits (§9.8); Tips/Boosts (§9.9); basic Paid Messages / Backer Inbox with accept/reject/refund (§9.10); creator payouts (available/pending balance, compliance checks, payout rails) and creator analytics dashboard (§7.7, §9.20). **Exit criterion:** a creator has a real P&L — the §12.2 split table is enforced by the ledger.

### Phase 5 — Social & retention
Roster (add/remove, backed status, weekly recap) (§9.16); Taste Score V1 and Fame Score V1 as explainable, driver-based scores computed by workers (§9.14, §9A.8); Backer Wall with permanent Genesis numbering; Street Team quests — creation, submission, verification, XP/badge/points rewards (§9.13); Backer Crews V1 — create/join, crew points, rankings (§9A.7); Live Launch Feed UI (§9A.11); Share Card Generator — all 12 templates from §0A.13 with platform aspect ratios and deep links; notifications across the §9.19 event list. **Exit criterion:** the status loop ("I was early and I can prove it") is shippable and screenshot-worthy.

### Phase 6 — Admin, trust & safety, launch ops
Admin dashboard per §8.4 — verification queue, draft moderation, creator/mission/content/payout review, fraud and wash-trading signals, takedowns, market pause, account suspension, full audit logs (§9.21); impersonation and duplicate detection; harassment reporting and user blocking (§15.9); disclosure/risk/error/refund states across all flows (§0B.12); Creator Launch Kit generator with built-in disclosure templates (§9.18, §0A.11); Genesis Draft operational tooling — launch calendar, staggered launch scheduling (§0A.7), public scoreboard, D-21→D+30 playbook support (§13A). **Exit criterion:** the platform can be operated safely through Genesis Season.

---

## 4. Cross-cutting compliance guardrails (engineering-enforced)

From §15 and §1.3–§1.4 — these are build rules, not copy suggestions:

1. **Consent gate:** no live market, price, token or monetization surface without creator status `LIVE`/`LAUNCHING_SOON` (enforced at the type/route level, see §2 above).
2. **Copy bank + lint:** all user-facing strings live in a copy module; a lint rule fails CI on banned terms ("invest", "stock", "profit from", "own a piece", "guaranteed", "human token") in UI copy, and required terms ("Back", "Genesis Backer", "fund the next move") are the canonical CTAs (§0B.8, §15A.5).
3. **Mandatory risk disclosure:** every purchase/back/subscribe flow renders the §15.3 disclosure component (not equity, not debt, not revenue share, price can go down, perks subject to terms, fee disclosure) — the confirm button is part of that component, so it cannot be omitted.
4. **Prohibited categories blocklist** (§15.4): nomination, mission and content review run against the prohibited list (tragedy, private life, allegations, minors, etc.); admin review is required before sensitive categories publish.
5. **No minors at V1** (§15.7): DOB/age attestation in claim flow; hard block.
6. **Prediction markets, protocol token, open token factory, leverage: out of scope** (§5.5) — no partial implementations.
7. **Anti-rug defaults** (§15.8): no unlocked creator premine, transparent fees, mission proof requirements, payout holds for high-risk cases, abandoned-creator labels.
8. **Influencer disclosure baked into Launch Kit templates** (§0A.11, §15.6).

---

## 5. Out of scope for V1

Per §5.5: unauthorized celebrity tokens, open token factory, full prediction markets, protocol token, revenue-share claims, order-book complexity for all markets, futures/options/leverage, minors as a category, tragedy/private-life markets, casino mechanics, native mobile app (mobile-first responsive web instead, §8.3).

---

## 6. Open questions / blockers (from §23)

Tracked here; each blocks the phase noted and needs an owner decision before that phase starts.

| # | Question (§23) | Blocks |
|---|---|---|
| 1 | Jurisdiction and legal structure | Phase 2 (KYC/terms), Phase 3 (market) |
| 2 | Payment rails and custody model | Phase 2 (pledge pre-auth), Phase 3 (ledger/custody) |
| 3 | Fan Demand Orders: binding vs refundable vs soft intent | Phase 2 |
| 4 | Opening Batch Auction allocation algorithm (pro-rata vs price-priority) | Phase 3 |
| 5 | Initial creator fee split (start from §12.2 table) | Phase 3 |
| 6 | Mission refund policy (all-or-nothing vs keep-what-you-raise) | Phase 4 |
| 7 | Launch categories (recommend §13.1: musicians, creators, builders, artists) | Phase 1 |
| 8 | Verification/KYC provider | Phase 2 |
| 9 | Backstage content rules | Phase 4 |
| 10 | Inactive-creator policy (abandonment labels, payout holds) | Phase 4/6 |
| 11 | Takedown SLA and process | Phase 1/6 |
| 12 | Fame Score formula weights | Phase 5 |
| 13 | Share-card moderation approach | Phase 5 |
| 14 | Match Fund size and caps | Phase 4 |
| 15 | Day-one live creator count (PRD recommends 5–10, §0A.7) | Launch ops |
| 16–18 | Onboarding SLA, launch staffing, external legal review scope | Launch ops |
