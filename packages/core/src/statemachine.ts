import type { Db, Prisma } from "@famerace/db";
import { DomainError } from "./errors";

/**
 * State-machine helper (implementation plan §2: "state machines are
 * first-class"). Validates a transition against an allowed-transitions map
 * and writes an AuditLog row. Callers run inside a Prisma transaction so the
 * status change, its side effects and the audit entry commit atomically.
 */
export function assertTransition<S extends string>(
  machine: string,
  allowed: Readonly<Record<S, readonly S[]>>,
  from: S,
  to: S,
): void {
  const nexts = allowed[from];
  if (!nexts || !nexts.includes(to)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `${machine}: cannot transition from ${from} to ${to}`,
      409,
    );
  }
}

export async function audit(
  db: Db | Prisma.TransactionClient,
  input: {
    actorId?: string | null;
    actorType?: "USER" | "ADMIN" | "SYSTEM";
    action: string;
    objectType: string;
    objectId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? "USER",
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId,
      before: input.before,
      after: input.after,
    },
  });
}

// ── Lifecycle maps (PRD §9.2, §9.6, §9.12, §9A.3/4/5) ──

import type {
  AuctionStatus,
  CreatorStatus,
  MarketStatus,
  MissionStatus,
  ThresholdStatus,
} from "@famerace/db";

export const CREATOR_TRANSITIONS: Readonly<Record<CreatorStatus, readonly CreatorStatus[]>> = {
  DRAFT: ["CLAIM_STARTED"],
  CLAIM_STARTED: ["VERIFICATION_PENDING", "DRAFT"],
  VERIFICATION_PENDING: ["APPROVED", "CLAIM_STARTED", "REMOVED"],
  APPROVED: ["LAUNCHING_SOON", "SUSPENDED", "REMOVED"],
  LAUNCHING_SOON: ["LIVE", "APPROVED", "SUSPENDED"],
  LIVE: ["PAUSED", "SUSPENDED"],
  PAUSED: ["LIVE", "SUSPENDED"],
  SUSPENDED: ["APPROVED", "LIVE", "REMOVED"],
  REMOVED: [],
};

export const MARKET_TRANSITIONS: Readonly<Record<MarketStatus, readonly MarketStatus[]>> = {
  PRE_LAUNCH_DEMAND: ["OPENING_AUCTION", "CLOSED"],
  OPENING_AUCTION: ["GENESIS_CURVE", "PRE_LAUNCH_DEMAND", "CLOSED"],
  GENESIS_CURVE: ["GRADUATION", "PAUSED", "CLOSED"],
  GRADUATION: ["MATURE", "PAUSED", "CLOSED"],
  MATURE: ["PAUSED", "CLOSED"],
  PAUSED: ["GENESIS_CURVE", "GRADUATION", "MATURE", "CLOSED"],
  CLOSED: [],
};

export const MISSION_TRANSITIONS: Readonly<Record<MissionStatus, readonly MissionStatus[]>> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["LIVE", "DRAFT"],
  LIVE: ["FUNDED", "PARTIALLY_FUNDED", "EXPIRED"],
  FUNDED: ["IN_PROGRESS", "DISPUTED"],
  PARTIALLY_FUNDED: ["IN_PROGRESS", "REFUNDED", "DISPUTED"],
  EXPIRED: ["REFUNDED"],
  IN_PROGRESS: ["COMPLETED", "DISPUTED"],
  COMPLETED: [],
  DISPUTED: ["IN_PROGRESS", "REFUNDED", "COMPLETED"],
  REFUNDED: [],
};

export const AUCTION_TRANSITIONS: Readonly<Record<AuctionStatus, readonly AuctionStatus[]>> = {
  SCHEDULED: ["COLLECTING", "FAILED"],
  COLLECTING: ["CLEARING", "FAILED"],
  CLEARING: ["SETTLED", "FAILED"],
  SETTLED: [],
  FAILED: [],
};

export const THRESHOLD_ORDER: readonly ThresholdStatus[] = [
  "NOT_READY",
  "ALMOST_READY",
  "THRESHOLD_MET",
  "LAUNCHING_SOON",
  "LIVE",
];
