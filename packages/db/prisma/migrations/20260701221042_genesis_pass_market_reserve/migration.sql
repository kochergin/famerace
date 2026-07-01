-- AlterEnum
ALTER TYPE "LedgerAccount" ADD VALUE 'MARKET_RESERVE';

-- CreateTable
CREATE TABLE "GenesisPass" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "tierCents" INTEGER NOT NULL,
    "backerNumber" INTEGER NOT NULL,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenesisPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenesisPass_creatorId_backerNumber_idx" ON "GenesisPass"("creatorId", "backerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GenesisPass_creatorId_backerNumber_key" ON "GenesisPass"("creatorId", "backerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GenesisPass_userId_creatorId_key" ON "GenesisPass"("userId", "creatorId");

-- AddForeignKey
ALTER TABLE "GenesisPass" ADD CONSTRAINT "GenesisPass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenesisPass" ADD CONSTRAINT "GenesisPass_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
