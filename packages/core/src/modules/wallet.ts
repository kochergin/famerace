import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@famerace/db";
import { DomainError, notFound } from "../errors";
import { moneyTx } from "../tx";
import type { PaymentAuthorization, PaymentProvider } from "../payments";

/**
 * USDC wallet rail. The magic contract: every account silently has a wallet —
 * no seed phrases, no gas, no "connect". Deposits credit a custodial balance
 * (webhook/onramp in prod, faucet in dev), every purchase debits it through
 * the standard PaymentProvider hold lifecycle, withdrawals go to the user's
 * own address instantly.
 *
 * Production wiring notes (interface stays identical):
 *  - depositAddress ← per-user address from the custody/AA provider
 *    (Privy / Coinbase Smart Wallet); credits arrive via signed webhook →
 *    creditDeposit(ref = tx hash) is already idempotent.
 *  - withdraw() enqueues an on-chain USDC transfer (paymaster covers gas).
 *  - Sanctions screening hooks in at creditDeposit / withdraw.
 */

export const MIN_WITHDRAW_CENTS = 500;
const FAUCET_CAP_CENTS = 100_000; // dev only: $1,000 per top-up tap

/** Every user gets an address lazily — invisible onboarding. */
export async function ensureDepositAddress(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { depositAddress: true },
  });
  if (user.depositAddress) return user.depositAddress;
  // Dev: deterministic placeholder. Prod: request from the custody provider.
  const address = `0x${createHash("sha256").update(`famerace:${userId}`).digest("hex").slice(0, 40)}`;
  await prisma.user.update({ where: { id: userId }, data: { depositAddress: address } });
  return address;
}

/** Credit a confirmed on-chain deposit. Idempotent by ref (tx hash). */
export async function creditDeposit(userId: string, amountCents: number, ref: string, memo?: string) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new DomainError("BAD_AMOUNT", "Deposit must be a positive amount");
  }
  return moneyTx(async (tx) => {
    const existing = await tx.walletEntry.findUnique({ where: { ref } });
    if (existing) return existing; // webhook retries are a fact of life
    const entry = await tx.walletEntry.create({
      data: { userId, kind: "DEPOSIT", deltaCents: amountCents, ref, memo: memo ?? null },
    });
    await tx.user.update({ where: { id: userId }, data: { usdcCents: { increment: amountCents } } });
    return entry;
  });
}

/** Dev faucet (env-gated): instant demo money so the flow feels alive. */
export async function faucet(userId: string, amountCents: number) {
  if (process.env.DEV_FAUCET !== "1") {
    throw new DomainError("FAUCET_OFF", "Top-ups run through the onramp in production");
  }
  const amount = Math.min(Math.max(1, Math.floor(amountCents)), FAUCET_CAP_CENTS);
  return creditDeposit(userId, amount, `faucet_${randomBytes(8).toString("hex")}`, "Dev faucet");
}

/** Withdraw to the user's own wallet address. */
export async function withdraw(userId: string, amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents < MIN_WITHDRAW_CENTS) {
    throw new DomainError("BAD_AMOUNT", `Minimum withdrawal is $${(MIN_WITHDRAW_CENTS / 100).toFixed(2)}`);
  }
  return moneyTx(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { walletAddress: true, usdcCents: true },
    });
    if (!user.walletAddress) {
      throw new DomainError("NO_ADDRESS", "Add your wallet address in Settings first");
    }
    const debit = await tx.user.updateMany({
      where: { id: userId, usdcCents: { gte: amountCents } },
      data: { usdcCents: { decrement: amountCents } },
    });
    if (debit.count === 0) {
      throw new DomainError("INSUFFICIENT_FUNDS", `You have $${(user.usdcCents / 100).toFixed(2)} available`);
    }
    return tx.walletEntry.create({
      data: {
        userId,
        kind: "WITHDRAWAL",
        deltaCents: -amountCents,
        memo: `To ${user.walletAddress}`,
      },
    });
  });
}

export async function history(userId: string, limit = 30) {
  return prisma.walletEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}

/**
 * PaymentProvider on top of the balance: authorize = conditional debit +
 * hold row; capture = hold consumed (value now lives in the product ledger);
 * release/refund = credit back. All serializable, overdraw impossible.
 */
export class UsdcPaymentProvider implements PaymentProvider {
  readonly name = "USDC";

  async authorize(input: { userId: string; amountCents: number; purpose: string }): Promise<PaymentAuthorization> {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new DomainError("BAD_AMOUNT", "Amount must be positive");
    }
    return moneyTx(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { id: input.userId, usdcCents: { gte: input.amountCents } },
        data: { usdcCents: { decrement: input.amountCents } },
      });
      if (debit.count === 0) {
        const user = await tx.user.findUnique({ where: { id: input.userId }, select: { usdcCents: true } });
        throw new DomainError(
          "INSUFFICIENT_FUNDS",
          `Wallet balance $${((user?.usdcCents ?? 0) / 100).toFixed(2)} — top up to continue`,
          402,
        );
      }
      const hold = await tx.paymentHold.create({
        data: { userId: input.userId, amountCents: input.amountCents, purpose: input.purpose },
      });
      await tx.walletEntry.create({
        data: { userId: input.userId, kind: "HOLD", deltaCents: -input.amountCents, memo: input.purpose },
      });
      return { authRef: hold.id, amountCents: input.amountCents, userId: input.userId };
    });
  }

  async capture(authRef: string): Promise<void> {
    await moneyTx(async (tx) => {
      const updated = await tx.paymentHold.updateMany({
        where: { id: authRef, status: "HELD" },
        data: { status: "CAPTURED" },
      });
      if (updated.count === 0) {
        const hold = await tx.paymentHold.findUnique({ where: { id: authRef } });
        if (!hold) throw notFound("Payment hold");
        if (hold.status === "CAPTURED") return; // idempotent
        throw new DomainError("HOLD_RELEASED", "This hold was already released");
      }
    });
  }

  async release(authRef: string): Promise<void> {
    await moneyTx(async (tx) => {
      const updated = await tx.paymentHold.updateMany({
        where: { id: authRef, status: "HELD" },
        data: { status: "RELEASED" },
      });
      if (updated.count === 0) return; // idempotent: already released or captured
      const hold = await tx.paymentHold.findUniqueOrThrow({ where: { id: authRef } });
      await tx.user.update({ where: { id: hold.userId }, data: { usdcCents: { increment: hold.amountCents } } });
      await tx.walletEntry.create({
        data: { userId: hold.userId, kind: "RELEASE", deltaCents: hold.amountCents, memo: hold.purpose },
      });
    });
  }

  /** Value out to the user: sell proceeds, post-capture refunds. */
  async payout(input: { userId: string; amountCents: number; memo: string }): Promise<void> {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return;
    await moneyTx(async (tx) => {
      await tx.user.update({ where: { id: input.userId }, data: { usdcCents: { increment: input.amountCents } } });
      await tx.walletEntry.create({
        data: { userId: input.userId, kind: "PAYOUT", deltaCents: input.amountCents, memo: input.memo },
      });
    });
  }
}
