-- CreateEnum
CREATE TYPE "WalletEntryKind" AS ENUM ('DEPOSIT', 'FAUCET', 'HOLD', 'RELEASE', 'REFUND', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "PaymentHoldStatus" AS ENUM ('HELD', 'CAPTURED', 'RELEASED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "depositAddress" TEXT,
ADD COLUMN     "usdcCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "WalletEntryKind" NOT NULL,
    "deltaCents" INTEGER NOT NULL,
    "ref" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentHold" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "PaymentHoldStatus" NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletEntry_ref_key" ON "WalletEntry"("ref");

-- CreateIndex
CREATE INDEX "WalletEntry_userId_createdAt_idx" ON "WalletEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentHold_userId_status_idx" ON "PaymentHold"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_depositAddress_key" ON "User"("depositAddress");

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHold" ADD CONSTRAINT "PaymentHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

