-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('OPEN', 'SETTLED');

-- AlterEnum
ALTER TYPE "CardTemplate" ADD VALUE 'MOMENTUM';

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "creatorAId" TEXT NOT NULL,
    "creatorBId" TEXT NOT NULL,
    "aBaseline" INTEGER NOT NULL,
    "bBaseline" INTEGER NOT NULL,
    "aFinal" INTEGER,
    "bFinal" INTEGER,
    "winnerId" TEXT,
    "status" "BattleStatus" NOT NULL DEFAULT 'OPEN',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaUnlock" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "atSeats" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Battle_status_endsAt_idx" ON "Battle"("status", "endsAt");

-- CreateIndex
CREATE INDEX "ArenaUnlock_creatorId_atSeats_idx" ON "ArenaUnlock"("creatorId", "atSeats");
