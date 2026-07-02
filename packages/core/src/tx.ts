import { Prisma, prisma } from "@famerace/db";

/**
 * Money-path transaction: SERIALIZABLE isolation with bounded retry.
 *
 * Every balance-mutating flow (curve buy/sell, Genesis Pass, drop purchase,
 * call stakes) reads state, computes, then writes. Under READ COMMITTED two
 * concurrent buyers can both read the same supply/price and one update wins —
 * breaking the reserve invariant. Serializable makes Postgres abort one of
 * the conflicting transactions (P2034); we retry it a few times.
 */
export async function moneyTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      if (code === "P2034" && attempt < 3) continue; // serialization conflict — safe to retry
      throw error;
    }
  }
  throw lastError;
}
