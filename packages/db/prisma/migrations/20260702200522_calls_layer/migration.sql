-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('OPEN', 'RESOLVED_YES', 'RESOLVED_NO', 'VOID');

-- CreateEnum
CREATE TYPE "CallMetric" AS ENUM ('HOLDER_COUNT', 'FAME_SCORE', 'PRICE_CENTS', 'MISSION_FUNDED', 'CONFIRMED_BACKERS');

-- CreateEnum
CREATE TYPE "CallSide" AS ENUM ('YES', 'NO');

-- AlterEnum
ALTER TYPE "CardTemplate" ADD VALUE 'CALLED_IT';

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "missionId" TEXT,
    "question" TEXT NOT NULL,
    "metric" "CallMetric" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'OPEN',
    "yesPoints" INTEGER NOT NULL DEFAULT 0,
    "noPoints" INTEGER NOT NULL DEFAULT 0,
    "resolvedValue" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallStake" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "CallSide" NOT NULL,
    "points" INTEGER NOT NULL,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallStake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_status_deadline_idx" ON "Call"("status", "deadline");

-- CreateIndex
CREATE INDEX "Call_creatorId_status_idx" ON "Call"("creatorId", "status");

-- CreateIndex
CREATE INDEX "CallStake_userId_settled_idx" ON "CallStake"("userId", "settled");

-- CreateIndex
CREATE UNIQUE INDEX "CallStake_callId_userId_key" ON "CallStake"("callId", "userId");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallStake" ADD CONSTRAINT "CallStake_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallStake" ADD CONSTRAINT "CallStake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
