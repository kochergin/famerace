import { prisma, type Prisma } from "@famerace/db";
import { DomainError, notFound } from "../errors";
import { moneyTx } from "../tx";
import { paymentProvider } from "../payments";
import { postLedgerTx } from "./ledger";
import { audit } from "../statemachine";

/**
 * The Advance ("claim & get paid today"): an instant advance against
 * AUTHORIZED pledged demand — money fans have already locked behind the
 * creator, so fronting a slice of it is bounded-risk. One advance per
 * creator, capped, repaid automatically out of earnings before any payout.
 */

export const ADVANCE_BPS = 2_000; // 20% of authorized pledged demand
export const ADVANCE_MIN_CENTS = 5_000; // $50 — below this the moment isn't worth it
export const ADVANCE_CAP_CENTS = 100_000; // $1,000 season cap

async function authorizedDemandCents(creatorId: string): Promise<number> {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    select: { draftProfileId: true },
  });
  if (!creator?.draftProfileId) return 0;
  const sum = await prisma.fanDemandOrder.aggregate({
    where: {
      draftProfileId: creator.draftProfileId,
      paymentAuthStatus: { in: ["AUTHORIZED", "CAPTURED"] },
      confirmationStatus: { not: "DECLINED" },
    },
    _sum: { amountCents: true },
  });
  return sum._sum.amountCents ?? 0;
}

export async function advanceStatus(creatorId: string) {
  const [taken, demand] = await Promise.all([
    prisma.creatorAdvance.findUnique({ where: { creatorId } }),
    authorizedDemandCents(creatorId),
  ]);
  const ceiling = Math.min(ADVANCE_CAP_CENTS, Math.floor((demand * ADVANCE_BPS) / 10_000));
  const eligibleCents = taken ? 0 : ceiling >= ADVANCE_MIN_CENTS ? ceiling : 0;
  return { taken, eligibleCents, demandCents: demand };
}

/** Take the advance: ledger it, then pay it straight to the wallet. */
export async function takeAdvance(userId: string) {
  const creator = await prisma.creator.findFirst({ where: { userId } });
  if (!creator) throw notFound("Creator profile");
  const { taken, eligibleCents } = await advanceStatus(creator.id);
  if (taken) throw new DomainError("ADVANCE_TAKEN", "You already took your season advance");
  if (eligibleCents <= 0) {
    throw new DomainError("NOT_ELIGIBLE", `Advance unlocks at $${(ADVANCE_MIN_CENTS / 100).toFixed(0)}+ of authorized demand`);
  }
  const advance = await moneyTx(async (tx) => {
    const row = await tx.creatorAdvance.create({
      data: { creatorId: creator.id, amountCents: eligibleCents },
    });
    await postLedgerTx(
      tx,
      "ADVANCE",
      [
        { account: "ADVANCE_POOL", deltaCents: -eligibleCents, creatorId: creator.id },
        { account: "EXTERNAL", deltaCents: eligibleCents, userId },
      ],
      { kind: "advance_disbursed", creatorId: creator.id },
    );
    await audit(tx, { actorId: userId, action: "ADVANCE_TAKEN", objectType: "Creator", objectId: creator.id });
    return row;
  });
  await paymentProvider.payout({ userId, amountCents: eligibleCents, memo: "Season advance" });
  return advance;
}

/**
 * Auto-repay outstanding advance from CREATOR_EARNED. Called by
 * payouts.requestPayout before the balance check, so earnings always clear
 * the advance first. Returns the amount repaid.
 */
export async function repayFromEarnings(
  tx: Prisma.TransactionClient,
  creatorId: string,
  availableCents: number,
): Promise<number> {
  const advance = await tx.creatorAdvance.findUnique({ where: { creatorId } });
  if (!advance) return 0;
  const outstanding = advance.amountCents - advance.repaidCents;
  if (outstanding <= 0) return 0;
  const repay = Math.min(outstanding, availableCents);
  if (repay <= 0) return 0;
  await postLedgerTx(
    tx,
    "ADVANCE",
    [
      { account: "CREATOR_EARNED", deltaCents: -repay, creatorId },
      { account: "ADVANCE_POOL", deltaCents: repay, creatorId },
    ],
    { kind: "advance_repaid", creatorId },
  );
  await tx.creatorAdvance.update({ where: { creatorId }, data: { repaidCents: { increment: repay } } });
  return repay;
}
