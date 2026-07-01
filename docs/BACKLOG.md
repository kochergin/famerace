# FameRace V1 — P0 Build Backlog

The PRD's build decision (§27) is explicit: *"turn this master spec into a P0 build backlog."* This backlog covers the **21 mandatory V1 modules** (§0A.19, cross-checked against §5.3) as epics, grouped by the phases defined in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §3. Schema references point to [DATA_MODEL.md](DATA_MODEL.md).

Priorities: everything here is **P0** (required for Genesis Draft launch) unless marked P1 (required before Genesis Season ends, not for day one).

**Status: implemented.** All P0 stories are built and covered by the integration suite (45 tests), except the two real payment-provider adapters (US-308 Stripe, US-309 stablecoin/embedded wallet) which need production credentials — the `PaymentProvider` interface, instant dev provider, ledger-backed money paths and wallet-address connect are all in place, so the adapters slot in without touching domain flows.

---

## Phase 0 — Foundation

### E0.1 Accounts & auth *(module 21 partial; §9.1)*
- [x] **US-001** As a visitor I can sign up / log in with email magic link or social OAuth, so that onboarding is one step. *AC: session persists; username auto-suggested; referral code generated on signup.*
- [x] **US-002** As a user I can connect a wallet to my account (adapter present, embedded-wallet provider behind interface). *AC: wallet address stored; no crypto jargon in default UI (§0B.11).*
- [x] **US-003** As a user I have a public profile showing Roster, Taste Score, badges, Scout rank, backer history, missions funded (§9.1). *AC: renders server-side; empty states designed (§0B.12).*
- [x] **US-004** As a user I can manage notification settings and block users. *AC: blocks suppress all surfaces.*
- [x] **US-005** As a signup I attest I am 18+ (§15.7). *AC: hard block otherwise.*

### E0.2 Design system "Electric Backstage" *(§0B)*
- [x] **US-006** Token set: deep black/graphite base, lime/pink/blue/chrome accents, status colors (launching=lime, draft=blue, trending=pink, funded=gold, backstage=burgundy) (§0B.3). *AC: dark, mobile-first; tabular-mono numerals.*
- [x] **US-007** Base components: creator card, badge, progress bar, countdown, stat tile, ticker feed row (§15A.3). *AC: creator card "tells a story in 3 seconds" (§0B.6); screenshot-worthy.*
- [x] **US-008** Copy bank module + CI lint banning investment language (§1.3, §15A.5). *AC: CI fails on "invest/stock/profit/own a piece/guaranteed".*

---

## Phase 1 — Draft layer

### E1.1 Draft Board *(module 1; §9A.1)*
- [x] **US-101** As a visitor I can browse the Draft Board ranked by fan demand, filtered by category and status. *AC: pledge totals, invite counts, scout attribution visible; SSR for sharing.*
- [x] **US-102** As a user I can share a Draft Rank card ("MIRA is #12 on FameRace Draft"). *AC: uses share-card service (E5.6).*

### E1.2 Draft Profiles *(module 2; §9A.2, §0A.6)*
- [x] **US-103** As a scout I can nominate a creator by handle/link with category + thesis + requested mission (§9.3). *AC: duplicate detection; enters moderation queue; no implied endorsement in UI.*
- [x] **US-104** As a visitor I see a Draft Profile with fan count, pledged demand, requested mission, scouts, claim status — and **no** price/token/market-cap/trading UI. *AC: structural gate verified by test asserting market components cannot mount on draft routes.*
- [x] **US-105** As a fan I can "Add to roster" and "Invite [creator]" from a Draft Profile. *AC: invite link carries scout/referral attribution.*
- [x] **US-106** As the subject of a Draft Profile I can request takedown from the profile itself (§15.1). *AC: visible takedown link; request enters T&S queue; profile hidden while under review if flagged for impersonation.*

---

## Phase 2 — Demand & claim

### E2.1 Fan Demand Orders + Demand Vault *(modules 3, 4; §0A.3, §9A.3)*
- [x] **US-201** As a fan I can place a demand order on a draft (intent types: Genesis Pass / mission pledge / market buy / Backstage). *AC: soft intent requires no payment; amounts aggregate on profile; expiry set.*
- [x] **US-202** As a fan I can upgrade an intent to a refundable pledge (card pre-authorization). *AC: money never moves to creator pre-launch; auto-release on expiry or non-claim.*
- [x] **US-203** As a fan I get a final confirmation window before any pledge becomes binding (§0A.3). *AC: explicit confirm; decline path releases authorization.*

### E2.2 Creator Claim Flow *(module 5; §9.2, §7.1)*
- [x] **US-204** As a creator I can claim my Draft Profile via claim link: verify social account(s), pass identity/KYC hook, pick category, accept terms + disclosures. *AC: status transitions per creator lifecycle; Claim Room state visible publicly (§0A.6).*
- [x] **US-205** As a creator I configure my launch: first mission, ≥3 perks, payout setup, launch kit review. *AC: launch checklist UI in creator dashboard (§8.4).*
- [x] **US-206** As an admin I review creator verification in a queue and approve/reject with notes. *AC: audit-logged.*

### E2.3 Launch Threshold Engine *(module 6; §9A.4, §0A.5)*
- [x] **US-207** As the system I evaluate threshold status (verified + 250 backers + $10k demand + mission + perks + kit + T&S) continuously and expose `NOT_READY/ALMOST_READY/THRESHOLD_MET`. *AC: thresholds are season config; public progress bar on Claim Room.*

### E2.4 Claim Bounty *(module 8; §9A.6, §0A.10)*
- [x] **US-208** As a scout I earn the claim bounty when my nominated creator claims and verifies. *AC: anti-spam eligibility rules; attribution to first valid nominator; share card on payout.*

---

## Phase 3 — Launch & market

### E3.1 Genesis Launch Countdown *(module 9; §0A.4)*
- [x] **US-301** As a fan I see a Launching Soon page with countdown, confirmed perks, first mission, opening demand and auction schedule. *AC: confirmation window opens for demand-order holders.*

### E3.2 Opening Batch Auction *(module 7; §9A.5)*
- [x] **US-302** As a backer with confirmed demand I participate in the opening auction; orders clear through one fair mechanism. *AC: allocation algorithm documented + deterministic; failed payments handled; refunds automatic; results disclosed (price/quantity).*
- [x] **US-303** As a Genesis backer I receive my badge, permanent backer number and Backer Wall spot at settlement. *AC: `backer_rank` immutable.*

### E3.3 Genesis Pass + bonding curve market *(§9.5–§9.6)*
- [x] **US-304** As a fan I can "Back" a live creator through tiers ($25/$100/$500/custom) with the §0B.8 trade sheet: benefits list + risk disclosure ("not equity, debt, revenue share or ownership"). *AC: disclosure component wraps confirm button; copy-lint enforced.*
- [x] **US-305** As a user I can sell back to the curve; price, fees (creator/protocol/scout split per §12.2) and simple price-impact language are shown. *AC: no slippage jargon (§0B.11); full transaction history; ledger double-entry balanced.*
- [x] **US-306** As an admin I can pause any market instantly (§9.6). *AC: pause blocks trades, shows status banner, audit-logged.*
- [x] **US-307** Anti-bot controls on launch: per-user rate limits, launch-window purchase caps. *AC: configurable per market.*

### E3.4 Payments *(module 21 of §5.3 "wallets/payment abstraction"; §16.4)*
- [ ] **US-308 (deferred: needs API keys)** Stripe provider behind `PaymentProvider` interface: charges, pre-auth, capture, refunds, subscription billing, payouts. *Interface, dev provider and ledger-backed flows are done; the Stripe adapter itself needs production credentials.* *AC: chargeback webhook handling; all flows ledger-backed.*
- [ ] **US-309 (P1, deferred: needs credentials)** Stablecoin/embedded-wallet provider behind same interface — the `PaymentProvider` interface and wallet-address connect are in place. *AC: no UI changes required to add provider.*

---

## Phase 4 — Monetization & missions

### E4.1 Mission Funding *(module 11; §9.12, §7.5)*
- [x] **US-401** As a creator I create a mission (goal, deadline, use of funds, reward tiers, proof requirements) which passes review before going live. *AC: full state machine; escrow account created.*
- [x] **US-402** As a backer I contribute to a mission and see live progress; contributions escrow until funded per refund rule. *AC: reward tiers assigned; mission card shareable.*
- [x] **US-403** As a creator I post mission updates + proof; backers get permanent "I helped fund this" badges on completion (§0A.12). *AC: update schedule reminders; disputes route to admin.*
- [x] **US-404 (P1)** Match Fund: eligible contributions matched at configured ratio within caps; public match dashboard (§9A.10, §0A.17).

### E4.2 Backstage *(module 12; §9.7)*
- [x] **US-405** As a creator I configure Backstage tiers (paid / holder-gated / free) and post to a locked feed with public previews. *AC: monthly billing; cancellation; moderation hooks.*
- [x] **US-406** As a fan I subscribe (or qualify via holding) and unlock the feed with notifications (§7.3). *AC: access revoked on lapse; previews never leak locked media.*

### E4.3 Paid Drops *(module 13; §9.8)*
- [x] **US-407** As a creator I publish a paid drop (media, price, preview, optional quantity limit, access rules); fans purchase and unlock (§7.4). *AC: revenue split per §12.2; sensitive categories require pre-publish review; non-revealing share card.*

### E4.4 Tips + paid messages *(§9.9–§9.10)*
- [x] **US-408** As a fan I can tip with quick amounts + optional message, public or private. *AC: anti-spam limits.*
- [x] **US-409** As a fan I can send a paid message; creator accepts/rejects/responds; rejection auto-refunds. *AC: blocked-words filter; report path.*

### E4.5 Creator payouts & analytics *(§7.7, §9.20)*
- [x] **US-410** As a creator I see available/pending balances and request payout; compliance/fraud checks run before send. *AC: payout review queue for flagged cases; history + export.*
- [x] **US-411** As a creator I see the analytics dashboard: earnings by stream, backers, subscribers, mission funding, market volume, audience growth. *AC: the §12.2 P&L is "instantly understandable".*

---

## Phase 5 — Social & retention

### E5.1 Roster *(module 14; §9.16, §0A.14)*
- [x] **US-501** As a user I build My Roster (backed + watched creators) with Taste Score, early rank, stats and weekly recap. *AC: "Generate Roster Card" produces the §0B.9 layout; never labeled "portfolio".*

### E5.2 Taste Score V1 *(module 15; §0A.15, §9A.8)*
- [x] **US-502** As a user I have an explainable Taste Score (earliness, creator growth, nominations, missions, quests, invites, diversity) computed weekly by a worker. *AC: drivers displayed; percentile + rank; share card.*

### E5.3 Fame Score V1 *(§9.14)*
- [x] **US-503** As a visitor I see a creator's Fame Score with drivers ("+31% follower growth, mission 73% funded…"). *AC: category-adjusted; recompute jobs; no fake precision.*

### E5.4 Backer Wall *(module 16; §0B.7)*
- [x] **US-504** As a Genesis backer I appear permanently on the creator's Backer Wall with my number. *AC: first-N display; share card.*

### E5.5 Street Team Quests + Crews *(modules 17, 18; §9.13, §9A.7)*
- [x] **US-505** As a creator I create quests (type, proof, reward, deadline, max completions); fans submit proof; creator/admin/auto verification grants rewards (§7.6). *AC: full quest state machine; XP/badges/points credited.*
- [x] **US-506** As a user I create/join a Backer Crew; crews accumulate points from missions, claims and quests and rank on a weekly leaderboard. *AC: crew page + crew share card; moderation for names.*

### E5.6 Share Card Generator *(module 20; §0A.13, §9A.12)*
- [x] **US-507** Server-side card renderer with all 12 templates (Backer, Roster, Scout, Claim, Mission, Breakout, Battle, Backer Wall, Draft Rank, Creator Revenue, Taste Score, Crew) in X/TikTok/IG-Story/Telegram aspect ratios with deep links. *AC: <1s generation; dynamic stats; moderation hook.*

### E5.7 Live Launch Feed *(module 19; §9A.11, §0A.9)*
- [x] **US-508** As a visitor I see a live homepage feed (claims, backs, mission funding, launches, rank changes, milestones) via SSE. *AC: survives reconnect (event table replay); homepage modules per §9.15.*

### E5.8 Notifications *(§9.19)*
- [x] **US-509** In-app + email notifications for the full §9.19 event list, respecting settings. *AC: batched digests to avoid spam.*

---

## Phase 6 — Admin, trust & safety, launch ops

### E6.1 Admin / Trust & Safety *(module 21; §9.21, §15.9)*
- [x] **US-601** Admin dashboard with queues per §8.4: verification, draft moderation, creator/mission/content review, payout review, reports, fraud signals, takedowns. *AC: every action audit-logged; SLAs surfaced.*
- [x] **US-602** Impersonation + duplicate detection on nominations and claims. *AC: flagged items block launch until cleared.*
- [x] **US-603** Prohibited-category enforcement (§15.4) across nominations, missions, content. *AC: blocklist config; human review path.*
- [x] **US-604** Wash-trading/bot signals with market pause and account suspension controls (§22.5). *AC: signals feed fraud queue.*
- [x] **US-605** Harassment reporting + user blocking end-to-end. *AC: reporter feedback loop.*

### E6.2 Creator Launch Kit *(module 10; §9.18, §0A.11)*
- [x] **US-606** As an approved creator I get an auto-generated launch kit (X post, IG story frames, TikTok script, Telegram/Discord posts, mission announcement, thank-you template, weekly prompts) with **disclosure language built in** (§15.6). *AC: kit requires admin approval as part of launch threshold.*

### E6.3 Genesis Draft launch ops *(§0A.7–§0A.9, §13A)*
- [x] **US-607** Launch calendar + staggered launch scheduling (day 1: 5–10 live; then 3–5/day). *AC: admin-managed; public reveal at D-7.*
- [x] **US-608** Public scoreboard on homepage (pledged total, backers, claims, missions funded) (§0A.8). *AC: live counters from event/ledger data.*
- [x] **US-609 (P1)** FameRace 100 weekly ranking pages (§4.6). *AC: category rankings; shareable.*

---

## Module coverage check (§0A.19 → epics)

| # | V1 module | Epic |
|---|---|---|
| 1 | Draft Board | E1.1 |
| 2 | Draft Profiles | E1.2 |
| 3 | Fan Demand Orders | E2.1 |
| 4 | Pledge / Demand Vault | E2.1 |
| 5 | Creator Claim Flow | E2.2 |
| 6 | Launch Threshold Engine | E2.3 |
| 7 | Opening Batch Auction | E3.2 |
| 8 | Claim Bounty | E2.4 |
| 9 | Genesis Launch Countdown | E3.1 |
| 10 | Creator Launch Kit | E6.2 |
| 11 | Mission Funding | E4.1 |
| 12 | Backstage basic feed | E4.2 |
| 13 | Paid Drops | E4.3 |
| 14 | Roster | E5.1 |
| 15 | Taste Score V1 | E5.2 |
| 16 | Backer Wall | E5.4 |
| 17 | Street Team Quests | E5.5 |
| 18 | Backer Crews V1 | E5.5 |
| 19 | Live Launch Feed | E5.7 |
| 20 | Share Card Generator | E5.6 |
| 21 | Admin / Trust & Safety / Verification | E6.1 (+E0.1, E2.2) |

Plus §5.3-only requirements covered: accounts (E0.1), payments/wallets (E3.4), bonding curve market (E3.3), creator profile (E1.2/E3.x), tips/paid messages (E4.4), scout nominations (E1.2), creator analytics (E4.5), notifications (E5.8).
