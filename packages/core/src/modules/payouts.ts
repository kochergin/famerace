import { prisma, type LedgerTxType } from "@famerace/db";
import { DomainError, notFound } from "../errors";
import { audit } from "../statemachine";
import { balance, postLedgerTx } from "./ledger";
import * as advanceMod from "./advance";
import { moneyTx } from "../tx";

// Creator payouts + analytics (PRD §7.7, §9.20). Available balance is the
// CREATOR_EARNED ledger balance; payouts debit it through a review pipeline.

export async function creatorBalances(creatorId: string) {
  const [earned, pendingPayouts] = await Promise.all([
    balance({ account: "CREATOR_EARNED", creatorId }),
    prisma.payout.aggregate({
      where: { creatorId, status: { in: ["REQUESTED", "COMPLIANCE_REVIEW", "APPROVED"] } },
      _sum: { amountCents: true },
    }),
  ]);
  const pendingCents = pendingPayouts._sum.amountCents ?? 0;
  return { earnedCents: earned, pendingCents, availableCents: earned - pendingCents };
}

export async function requestPayout(userId: string, amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents < 1_000) {
    throw new DomainError("BAD_AMOUNT", "Minimum payout is $10");
  }
  const creatorRow = await prisma.creator.findFirst({ where: { userId } });
  if (!creatorRow) throw notFound("Creator profile");
  if (creatorRow.payoutStatus !== "ACTIVE") {
    throw new DomainError("PAYOUT_NOT_CONFIGURED", "Activate payouts in your dashboard first");
  }
  // Outstanding advance clears from earnings FIRST, in its own committed
  // transaction — a rejected payout request must not roll the repayment back.
  const pre = await creatorBalances(creatorRow.id);
  const repaid =
    pre.availableCents > 0
      ? await moneyTx((tx) => advanceMod.repayFromEarnings(tx, creatorRow.id, pre.availableCents))
      : 0;
  return prisma.$transaction(async (tx) => {
    const creator = creatorRow;
    const availableCents = pre.availableCents - repaid;
    if (amountCents > availableCents) {
      throw new DomainError(
        "INSUFFICIENT_BALANCE",
        repaid > 0
          ? `$${(repaid / 100).toFixed(2)} cleared your advance first — $${(availableCents / 100).toFixed(2)} available`
          : "Amount exceeds your available balance",
      );
    }
    // High-value payouts route through compliance review (PRD §9.21, §15.8).
    const needsReview = amountCents >= 100_000;
    const payout = await tx.payout.create({
      data: {
        creatorId: creator.id,
        amountCents,
        status: needsReview ? "COMPLIANCE_REVIEW" : "APPROVED",
      },
    });
    await audit(tx, { actorId: userId, action: "PAYOUT_REQUESTED", objectType: "Payout", objectId: payout.id });
    if (needsReview) {
      await tx.moderationItem.create({
        data: { objectType: "Payout", objectId: payout.id, queue: "PAYOUT_REVIEW" },
      });
    }
    return payout;
  });
}

/** Send an approved payout over the configured rail (dev rail: instant). */
export async function sendPayout(actorId: string, payoutId: string, actorType: "ADMIN" | "SYSTEM" = "SYSTEM") {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw notFound("Payout");
    if (payout.status !== "APPROVED") {
      throw new DomainError("NOT_APPROVED", `Payout is ${payout.status}`);
    }
    const ledgerTxId = await postLedgerTx(
      tx,
      "PAYOUT",
      [
        { account: "CREATOR_EARNED", deltaCents: -payout.amountCents, creatorId: payout.creatorId },
        { account: "EXTERNAL", deltaCents: payout.amountCents, creatorId: payout.creatorId },
      ],
      { kind: "payout", payoutId },
    );
    const updated = await tx.payout.update({
      where: { id: payoutId },
      data: { status: "SENT", ledgerTxId },
    });
    await audit(tx, { actorId, actorType, action: "PAYOUT_SENT", objectType: "Payout", objectId: payoutId });
    return updated;
  });
}

export async function approvePayout(adminId: string, payoutId: string) {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({ where: { id: payoutId } });
    if (!payout || payout.status !== "COMPLIANCE_REVIEW") throw notFound("Payout under review");
    await tx.payout.update({ where: { id: payoutId }, data: { status: "APPROVED", reviewedByUserId: adminId } });
    await tx.moderationItem.updateMany({
      where: { objectType: "Payout", objectId: payoutId, queue: "PAYOUT_REVIEW" },
      data: { status: "APPROVED", assigneeUserId: adminId },
    });
    await audit(tx, { actorId: adminId, actorType: "ADMIN", action: "PAYOUT_APPROVED", objectType: "Payout", objectId: payoutId });
  });
}

/** Earnings by revenue stream for the analytics dashboard (PRD §9.20). */
export async function earningsByStream(creatorId: string) {
  const rows = await prisma.ledgerEntry.groupBy({
    by: ["txId"],
    where: { account: "CREATOR_EARNED", creatorId, deltaCents: { gt: 0 } },
    _sum: { deltaCents: true },
  });
  const txIds = rows.map((row) => row.txId);
  const txs = await prisma.ledgerTx.findMany({ where: { id: { in: txIds } }, select: { id: true, type: true } });
  const typeById = new Map(txs.map((t) => [t.id, t.type]));
  const byStream: Partial<Record<LedgerTxType, number>> = {};
  for (const row of rows) {
    const type = typeById.get(row.txId);
    if (!type) continue;
    byStream[type] = (byStream[type] ?? 0) + (row._sum.deltaCents ?? 0);
  }
  return byStream;
}

export async function creatorAnalytics(creatorId: string) {
  const [balances, byStream, passCount, memberCount, missionAgg, market, payoutHistory] = await Promise.all([
    creatorBalances(creatorId),
    earningsByStream(creatorId),
    prisma.genesisPass.count({ where: { creatorId } }),
    prisma.backstageMembership.count({ where: { creatorId, status: "ACTIVE" } }),
    prisma.mission.aggregate({ where: { creatorId }, _sum: { fundedCents: true } }),
    prisma.creatorMarket.findUnique({ where: { creatorId } }),
    prisma.payout.findMany({ where: { creatorId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return {
    balances,
    byStream,
    passCount,
    memberCount,
    missionFundedCents: missionAgg._sum.fundedCents ?? 0,
    market,
    payoutHistory,
  };
}
