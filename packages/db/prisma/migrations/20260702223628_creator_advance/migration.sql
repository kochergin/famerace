-- AlterEnum
ALTER TYPE "LedgerAccount" ADD VALUE 'ADVANCE_POOL';

-- AlterEnum
ALTER TYPE "LedgerTxType" ADD VALUE 'ADVANCE';

-- CreateTable
CREATE TABLE "CreatorAdvance" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "repaidCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorAdvance_creatorId_key" ON "CreatorAdvance"("creatorId");
