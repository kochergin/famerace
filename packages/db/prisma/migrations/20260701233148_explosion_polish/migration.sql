-- AlterTable
ALTER TABLE "CreatorMarket" ALTER COLUMN "volumeTotalCents" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "DraftProfile" ADD COLUMN     "lastRank" INTEGER;

-- AlterTable
ALTER TABLE "Drop" ALTER COLUMN "revenueCents" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "MatchFund" ALTER COLUMN "totalCents" SET DATA TYPE BIGINT,
ALTER COLUMN "spentCents" SET DATA TYPE BIGINT;
