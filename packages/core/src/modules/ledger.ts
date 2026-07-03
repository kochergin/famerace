import { prisma, type LedgerAccount, type LedgerTxType, type Prisma } from "@famerace/db";
import { DomainError } from "../errors";

// Double-entry ledger (implementation plan §2): every value movement writes
// balanced entries. EXTERNAL is the counter-account for money entering or
// leaving the platform (card charges, payouts).

export type EntryInput = {
  account: LedgerAccount;
  deltaCents: number;
  userId?: string | null;
  creatorId?: string | null;
  missionId?: string | null;
};

/** Post a balanced ledger transaction. Throws if entries do not sum to zero. */
export async function postLedgerTx(
  tx: Prisma.TransactionClient,
  type: LedgerTxType,
  entries: EntryInput[],
  reference?: Prisma.InputJsonValue,
): Promise<string> {
  const sum = entries.reduce((total, entry) => total + entry.deltaCents, 0);
  if (sum !== 0) {
    throw new DomainError("UNBALANCED_LEDGER", `Ledger tx ${type} entries sum to ${sum}, expected 0`, 500);
  }
  if (entries.some((entry) => !Number.isInteger(entry.deltaCents))) {
    throw new DomainError("BAD_LEDGER_AMOUNT", "Ledger amounts must be integer cents", 500);
  }
  const ledgerTx = await tx.ledgerTx.create({
    data: {
      type,
      reference,
      entries: {
        create: entries.map((entry) => ({
          account: entry.account,
          deltaCents: entry.deltaCents,
          userId: entry.userId ?? null,
          creatorId: entry.creatorId ?? null,
          missionId: entry.missionId ?? null,
        })),
      },
    },
  });
  return ledgerTx.id;
}

/** Balance of an account dimension (e.g. a creator's earned balance). */
export async function balance(
  where: {
    account: LedgerAccount;
    userId?: string;
    creatorId?: string;
    missionId?: string;
  },
  client: { ledgerEntry: { aggregate: typeof prisma.ledgerEntry.aggregate } } = prisma,
): Promise<number> {
  const agg = await client.ledgerEntry.aggregate({
    where: {
      account: where.account,
      ...(where.userId ? { userId: where.userId } : {}),
      ...(where.creatorId ? { creatorId: where.creatorId } : {}),
      ...(where.missionId ? { missionId: where.missionId } : {}),
    },
    _sum: { deltaCents: true },
  });
  return agg._sum.deltaCents ?? 0;
}

/** Whole-ledger invariant: all entries across all txs sum to zero. */
export async function assertLedgerBalanced(): Promise<void> {
  const agg = await prisma.ledgerEntry.aggregate({ _sum: { deltaCents: true } });
  const total = agg._sum.deltaCents ?? 0;
  if (total !== 0) {
    throw new DomainError("LEDGER_DRIFT", `Ledger out of balance by ${total} cents`, 500);
  }
}
