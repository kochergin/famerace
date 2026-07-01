# FameRace V1 — Data Model

Concrete schema spec derived from [PRD.md](PRD.md) §10 (core objects) and §10A (V2 explosion objects), plus the state machines scattered through §9/§9A. Target: PostgreSQL via Prisma (`packages/db`). Field lists below are the PRD's conceptual fields normalized into relational form; `snake_case` names map 1:1 to Prisma models in implementation.

Conventions: every table has `id` (cuid), `created_at`, `updated_at`. All status columns are Postgres enums. All state transitions write an `audit_log` row. Money is stored as integer minor units with a `currency` column; all value movement is double-entry in `ledger_entry`.

---

## 1. Identity & roles

### user (§10.1)
`username` (unique), `display_name`, `avatar_url`, `email` (unique, nullable for wallet-only), `wallet_address` (nullable), `auth_methods` (enum[]: EMAIL, OAUTH_X, OAUTH_GOOGLE, WALLET), `country`, `roles` (enum[]: BACKER, SCOUT, CREATOR, ADMIN, MODERATOR), `referral_code` (unique), `referred_by_user_id`, `dob_attested_18plus` (bool — §15.7 gate), `status` (ACTIVE, SUSPENDED, BANNED, DELETED).

Related: `user_badge` (badge_type, source_ref, awarded_at — permanent proof objects, §15A.3), `notification_setting`, `user_block` (blocker/blocked, §15.9).

### creator (§10.2)
`user_id` (nullable until claim completes), `draft_profile_id` (nullable — provenance if born from a draft), `display_name`, `handle` (unique), `category` (enum: MUSICIAN, INTERNET_CREATOR, BUILDER_FOUNDER, ARTIST_DESIGNER — §13.1; ATHLETE reserved post-V1), `bio`, `story`, `social_links` (jsonb), `verification_status` (UNVERIFIED, PENDING, VERIFIED, REJECTED), `payout_status` (NOT_CONFIGURED, PENDING, ACTIVE, HELD), `fame_score` (denormalized latest), `profile_status`, `launch_status` (see state machine below), `approved_at`.

**Creator lifecycle (§9.2):**

```
DRAFT → CLAIM_STARTED → VERIFICATION_PENDING → APPROVED → LAUNCHING_SOON → LIVE
                                                   ↓            ↓            ↓
                                               PAUSED ⇄ ────────┴──── SUSPENDED → REMOVED
```

---

## 2. Draft layer (pre-market)

### draft_profile (§10A.1)
`name_or_handle`, `external_link`, `category`, `status` (see below), `nominated_by_user_id`, `fan_count` (denormalized watcher count), `pledged_demand_total` (denormalized from demand orders), `requested_mission_text`, `invite_count`, `claim_status` (UNCLAIMED, CLAIM_STARTED, CLAIMED), `takedown_status` (NONE, REQUESTED, UNDER_REVIEW, REMOVED), `moderation_status` (PENDING, APPROVED, REJECTED, FLAGGED), `claimed_creator_id` (nullable).

**Hard rule (§9A.2 / §15.1):** `draft_profile` has **no** relations to `creator_market`, `holding` or any monetization table. Price/token/trading are structurally impossible on drafts.

**Draft status (§0A.6):** `DRAFT_STUB → CLAIM_ROOM → LAUNCHING_SOON → LIVE` (the last two live on `creator` once claimed).

### scout_nomination (§10.9)
`scout_user_id`, `draft_profile_id`, `creator_handle`, `category`, `thesis` (text), `requested_mission`, `status` (PENDING, APPROVED, REJECTED, DUPLICATE), `claim_result` (NONE, CLAIMED, EXPIRED). Duplicate detection: unique partial index on normalized handle + category.

### claim_bounty (§9A.6)
`draft_profile_id`, `amount_or_points`, `eligibility_rules` (jsonb), `status` (OPEN, LOCKED, PAID, EXPIRED), `paid_to_user_id` (scout attribution).

### takedown_request (§15.9)
`draft_profile_id` / `creator_id`, `requester_contact`, `reason`, `status` (RECEIVED, UNDER_REVIEW, ACTIONED, REJECTED), `resolved_by_admin_id`.

---

## 3. Demand & launch

### fan_demand_order (§10A.2)
`user_id`, `draft_profile_id` (nullable), `creator_id` (nullable — set on claim), `intent_type` (GENESIS_PASS, MISSION_PLEDGE, MARKET_BUY, BACKSTAGE — §0A.3), `amount`, `currency`, `binding_status` (SOFT_INTENT, REFUNDABLE_PLEDGE, PRE_AUTHORIZED), `payment_authorization_status` (NONE, AUTHORIZED, CAPTURED, RELEASED, FAILED), `confirmation_status` (UNCONFIRMED, CONFIRMATION_WINDOW, CONFIRMED, DECLINED), `expires_at`, `refund_status` (NONE, PENDING, REFUNDED).

Lifecycle (§0A.3 safety rules): money never reaches the creator before official launch; unclaimed → expires/refunds; threshold unmet → market never opens.

### launch_threshold (§10A.3)
1:1 with `creator`. `required_backers` (250 default), `required_demand` ($10k default), `required_mission_configured`, `required_perks_count` (3), `creator_verified`, `launch_kit_approved`, `safety_approved`, computed `threshold_status`: `NOT_READY → ALMOST_READY → THRESHOLD_MET → LAUNCHING_SOON → LIVE` (§9A.4). Requirements are per-season config, not constants (§0A.5 "Example Season 1 threshold").

### opening_auction (§10A.4)
`creator_market_id`, `start_time`, `end_time`, `status` (SCHEDULED, COLLECTING, CLEARING, SETTLED, FAILED), `clearing_price`, `clearing_result` (jsonb), `allocation_result` (jsonb), `failed_payment_count`, `refund_status`, `launched_at`. Child table `auction_order`: `user_id`, `fan_demand_order_id`, `amount`, `fill_amount`, `status` (CONFIRMED, FILLED, PARTIAL, REFUNDED, FAILED).

---

## 4. Market

### creator_market (§10.3)
`creator_id` (1:1), `ticker` (unique), `status` (PRE_LAUNCH_DEMAND, OPENING_AUCTION, GENESIS_CURVE, GRADUATION, MATURE, PAUSED, CLOSED — §9.6 stages), `curve_params` (jsonb), `price`, `supply`, `holder_count`, `volume_24h`, `volume_total`, `creator_fee_bps`, `protocol_fee_bps`, `scout_fee_bps` (§12.2 splits as config), `launch_time`, `graduation_status`.

### holding (§10.4)
`user_id` + `creator_market_id` (unique pair), `amount`, `average_entry`, `first_backed_at`, `backer_rank` (permanent Genesis numbering — feeds Backer Wall §0B.7).

### market_transaction
`creator_market_id`, `user_id`, `side` (BUY, SELL), `amount`, `price`, `fees` (jsonb breakdown), `ledger_tx_id`. Full history per §9.6.

### ledger_entry / ledger_tx
Double-entry backbone (implementation plan §2): `ledger_tx` (type: PLEDGE_AUTH, AUCTION_FILL, CURVE_TRADE, MISSION_CONTRIBUTION, MISSION_ESCROW_RELEASE, SUBSCRIPTION, DROP_SALE, TIP, MESSAGE_FEE, PAYOUT, REFUND, MATCH_FUND, FEE) with balanced `ledger_entry` rows (`account`, `delta`, `currency`). Accounts: user cash, creator earned, creator pending, mission escrow, platform fees, scout rewards, match fund.

---

## 5. Monetization

### backstage_membership (§10.5)
`user_id`, `creator_id`, `tier_id`, `status` (ACTIVE, PAST_DUE, CANCELED, EXPIRED), `started_at`, `renews_at`, `price`, `payment_method`, `access_type` (PAID, HOLDER_GATED, FREE — §9.7). Child: `backstage_tier` (creator_id, name, price, benefits jsonb).

### backstage_post
`creator_id`, `body`, `media` (jsonb), `visibility` (PUBLIC_PREVIEW, MEMBERS, HOLDERS, TIER), `status` (DRAFT, PUBLISHED, REMOVED).

### drop (§10.6)
`creator_id`, `title`, `description`, `media_url`, `preview_url`, `price`, `quantity_limit`, `sold_count`, `access_rules` (jsonb), `status` (DRAFT, UNDER_REVIEW, LIVE, SOLD_OUT, REMOVED), `revenue_total`. Child: `drop_purchase`.

### tip
`from_user_id`, `creator_id`, `amount`, `message`, `is_public`, `ledger_tx_id` (§9.9).

### paid_message (§9.10)
`from_user_id`, `creator_id`, `price`, `body`, `status` (SENT, ACCEPTED, RESPONDED, REJECTED, REFUNDED, FLAGGED).

### creator_request_item / request_order (§9.11)
Menu item: `creator_id`, `title`, `price`, `delivery_days`, `availability`. Order: `status` (REQUESTED, ACCEPTED, DELIVERED, APPROVED, REFUNDED, DISPUTED).

### payout (§7.7)
`creator_id`, `amount`, `rail` (STRIPE, STABLECOIN), `status` (REQUESTED, COMPLIANCE_REVIEW, APPROVED, SENT, FAILED, HELD), `reviewed_by_admin_id`.

---

## 6. Missions

### mission (§10.7, §9.12)
`creator_id`, `title`, `category`, `goal_amount`, `funded_amount`, `deadline`, `use_of_funds`, `reward_tiers` (jsonb: threshold → reward per §4.3 example), `proof_requirements`, `update_schedule`, `refund_rule` (ALL_OR_NOTHING, KEEP_WHAT_RAISED — pending open question #6), `match_eligible`, `match_cap`, `status`:

```
DRAFT → UNDER_REVIEW → LIVE → FUNDED → IN_PROGRESS → COMPLETED
                          ↓        ↘ PARTIALLY_FUNDED / EXPIRED → REFUNDED
                       DISPUTED ────────────────────────────────↗
```

Children: `mission_contribution` (user, amount, tier, ledger_tx_id, match_amount), `mission_update` (creator posts + proof media).

### match_fund (§9A.10)
Season-scoped: `season_id`, `total_budget`, `match_ratio` (e.g. 0.25), `category_caps` (jsonb), `creator_cap`, `spent`, `status`. Public dashboard reads from it.

---

## 7. Social, growth & scores

### quest (§10.8, §9.13)
`creator_id`, `title`, `description`, `type` (SHARE, INVITE, CONTENT, PLAYLIST, ENGAGEMENT, MEME, TRANSLATION, FEEDBACK, LAUNCH_SUPPORT, BRAND_INTRO, EVENT), `proof_type` (LINK, SCREENSHOT, AUTO), `reward_type` (XP, BADGE, POINTS, ACCESS, DROP, SHOUTOUT, FEE_REBATE, CREW_POINTS), `reward_amount`, `deadline`, `max_completions`, `verification_method` (CREATOR, ADMIN, AUTO), `status` (DRAFT, LIVE, CLOSED). Child: `quest_completion` (user, proof_ref, status: SUBMITTED, APPROVED, REJECTED).

### roster_entry (§9A.9)
`user_id` + `creator_or_draft_id` (unique pair), `added_at`, `source` (BACKED, WATCHING, NOMINATED).

### crew / crew_member (§10A.5)
Crew: `name` (unique), `creator_id` (optional), `category` (optional), `score`, `missions_funded`, `quests_completed`, `creators_claimed`, `rank`, `status`. Member: `user_id`, `role` (FOUNDER, MEMBER), `points`.

### taste_score (§10A.6)
Per user, versioned rows: `score`, `percentile`, `rank`, `drivers` (jsonb — explainability required §9A.8), `weekly_change`, `share_card_url`, `computed_at`. Inputs per §0A.15: earliness, creator growth after backing, nominations, missions, quests, invites, roster performance, diversity.

### fame_score (§10.10)
Per creator, versioned rows: `score`, `previous_score`, `drivers` (jsonb — §9.14 requires explainable display), `category_percentile`, `confidence`, `computed_at`. Category-adjusted, manipulation-resistant (inputs weighted server-side by workers).

### event (§10.11)
Live-feed source of truth: `type` (CREATOR_CLAIMED, MISSION_FUNDED, USER_BACKED, MARKET_LAUNCHED, DRAFT_RANK_CHANGED, DROP_RELEASED, QUEST_COMPLETED, CREW_RANKED_UP, CREATOR_MILESTONE — §9A.11), `actor_id`, `creator_id`, `related_object_id`, `metadata` (jsonb), `visibility` (PUBLIC, HOLDERS, PRIVATE).

### share_card (§9A.12)
`user_id`, `template` (12-template enum from §0A.13: BACKER, ROSTER, SCOUT, CLAIM, MISSION, BREAKOUT, BATTLE, BACKER_WALL, DRAFT_RANK, CREATOR_REVENUE, TASTE_SCORE, CREW), `subject_ref`, `image_url`, `deep_link`, `aspect_ratio`, `moderation_status`.

### notification (§9.19)
`user_id`, `type` (full §9.19 list), `payload` (jsonb), `read_at`, `channel` (IN_APP, EMAIL, PUSH).

---

## 8. Trust & safety / admin

### moderation_item (§9.21)
Polymorphic queue: `object_type` (DRAFT_PROFILE, CREATOR, MISSION, POST, DROP, SHARE_CARD, QUEST, MESSAGE), `object_id`, `queue` (VERIFICATION, DRAFT_MOD, CONTENT, MISSION_REVIEW, PAYOUT_REVIEW), `status` (PENDING, APPROVED, REJECTED, ESCALATED), `assignee_admin_id`, `notes`.

### report
`reporter_user_id`, `object_type`/`object_id`, `reason` (IMPERSONATION, HARASSMENT, PROHIBITED_CATEGORY, FRAUD, OTHER — §15.4 categories), `status`.

### fraud_signal
`object_type`/`object_id`, `signal` (WASH_TRADING, BOT_ACTIVITY, DUPLICATE_PROFILE, PAYMENT_ABUSE), `score`, `metadata`, `status` (OPEN, CONFIRMED, DISMISSED).

### audit_log
`actor_id` (user/admin/system), `action`, `object_type`/`object_id`, `before`/`after` (jsonb). Written by every state-machine transition and every admin action (§9.21).

---

## 9. Entity relationship overview

```
user ─┬─< scout_nomination >── draft_profile ──(claim)──> creator ──1:1── creator_market ──< market_transaction
      ├─< fan_demand_order >──┘        │                     │  │              │
      ├─< holding >────────────────────│─────────────────────│──┘        opening_auction ──< auction_order
      ├─< roster_entry                 │                     ├─< mission ──< mission_contribution
      ├─< backstage_membership ────────│─────────────────────┤─< backstage_post / drop / tip / paid_message
      ├─< quest_completion             │                     ├─< quest
      ├─< crew_member >── crew         │                     ├─1:1─ launch_threshold
      ├── taste_score (versioned)      │                     ├── fame_score (versioned)
      └─< share_card / notification    └── claim_bounty      └─< payout
                          event / audit_log / ledger_tx span all of the above
```
