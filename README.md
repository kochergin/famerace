# FameRace

**Back the rise.** — FameRace is the internet's talent draft: a career launchpad where fans discover, fund and back rising creators before the world notices.

> Market creates attention. Backstage creates revenue. Missions create life-change. Street Team creates virality. Proof-of-early creates status.

FameRace is **not** a "people exchange." Anyone can *draft* a rising creator, but only verified, consenting creators can go live. Demand is collected before launch (the Draft Vault), so every creator market opens with a crowd.

## Core product loop

```
Draft → Vault → Claim → Launch → Back → Mission → Backstage → Street Team → Roster → Share → Repeat
```

## Documentation

| Document | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Canonical product spec — Final Master Strategy + PRD V2 "Explosion Edition". All section references (§) in the other docs point here. |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Engineering implementation plan: tech stack, architecture, phased build plan, compliance guardrails. |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Concrete data model: entities, fields, enums and state machines derived from PRD §10/§10A. |
| [docs/BACKLOG.md](docs/BACKLOG.md) | P0 build backlog: epics and user stories for the 21 mandatory V1 modules, with acceptance criteria and phase assignments. |

## Quickstart

Requirements: Node 20+, PostgreSQL 16.

```bash
createdb famerace && createdb famerace_test   # as a postgres superuser, or use your own DBs
cp .env.example .env                          # set DATABASE_URL + SESSION_SECRET
npm install                                   # postinstall fetches Prisma engines via curl
npm run db:deploy                             # apply migrations
npm run db:seed                               # Genesis Draft demo data (optional)
npm run dev                                   # http://localhost:3000
```

Seed logins (password `famerace-demo-1`): `admin` (trust & safety panel at `/admin`), `mira_irl` (live creator), `kai_builds` (launching soon), `novafan` (backer).

Checks: `npm run check` = typecheck + copylint (bans investment language per PRD §1.3) + integration tests against `famerace_test`.

## Implementation status

V1 is implemented through all six phases of the plan: draft layer, demand vault + claim flow + launch thresholds, opening batch auction + bonding-curve market + Genesis Passes on a double-entry ledger, missions with escrow, Backstage/drops/tips/payouts, roster + Taste/Fame scores + Street Team + crews + live feed + share cards, and the admin/trust-and-safety surface. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) §6 for the open product decisions (custody, refund policy, KYC provider) that gate a production launch.
