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
}

export const paymentProvider: PaymentProvider = new DevPaymentProvider();
