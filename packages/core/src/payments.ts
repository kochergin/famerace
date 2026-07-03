import { randomBytes } from "node:crypto";

/**
 * Payment abstraction (implementation plan §1): pledge pre-authorizations,
 * captures and releases go through this interface so Stripe / stablecoin
 * providers can be added without touching domain flows (PRD §16.4).
 *
 * The dev provider approves everything instantly and never moves real money —
 * value movement is recorded in the double-entry ledger, which is the
 * auditable source of truth in every environment.
 */
export type PaymentAuthorization = {
  authRef: string;
  amountCents: number;
  userId: string;
};

export interface PaymentProvider {
  readonly name: string;
  /** Place a hold (card pre-auth / escrow lock). No funds move yet. */
  authorize(input: { userId: string; amountCents: number; purpose: string }): Promise<PaymentAuthorization>;
  /** Capture a previously placed hold (funds move). */
  capture(authRef: string): Promise<void>;
  /** Release a hold without capturing (refund the authorization). */
  release(authRef: string): Promise<void>;
  /** Pay value OUT to a user (sell proceeds, refunds after capture). */
  payout(input: { userId: string; amountCents: number; memo: string }): Promise<void>;
}

class DevPaymentProvider implements PaymentProvider {
  readonly name = "DEV";

  async authorize(input: { userId: string; amountCents: number; purpose: string }) {
    return {
      authRef: `dev_${input.purpose}_${randomBytes(8).toString("hex")}`,
      amountCents: input.amountCents,
      userId: input.userId,
    };
  }

  async capture(): Promise<void> {
    // Instant success in dev. A real provider confirms asynchronously via webhook.
  }

  async release(): Promise<void> {
    // Instant success in dev.
  }

  async payout(): Promise<void> {
    // Instant success in dev — the ledger records the value movement.
  }
}

import { UsdcPaymentProvider } from "./modules/wallet";

const dev = new DevPaymentProvider();
const usdc = new UsdcPaymentProvider();
const active = (): PaymentProvider => (process.env.PAYMENT_PROVIDER === "usdc" ? usdc : dev);

/** PAYMENT_PROVIDER=usdc runs everything off wallet balances (the native
 *  rail); anything else keeps the instant dev provider. Resolved per call so
 *  env is read at runtime, not at import order. */
export const paymentProvider: PaymentProvider = {
  get name() {
    return active().name;
  },
  authorize: (input) => active().authorize(input),
  capture: (authRef) => active().capture(authRef),
  release: (authRef) => active().release(authRef),
  payout: (input) => active().payout(input),
};

/**
 * Charge a hold ONLY if the work commits. Authorize up front, run the domain
 * transaction, capture on success, release on any failure — so a validation
 * error (sold out, already a member, market closed) never leaves a user's
 * money captured with nothing delivered. This is the buy() pattern, shared.
 */
export async function withHeldCharge<T>(
  input: { userId: string; amountCents: number; purpose: string },
  work: () => Promise<T>,
): Promise<T> {
  const auth = await paymentProvider.authorize(input);
  try {
    const result = await work();
    await paymentProvider.capture(auth.authRef);
    return result;
  } catch (error) {
    await paymentProvider.release(auth.authRef).catch(() => {});
    throw error;
  }
}

