-- AlterTable
ALTER TABLE "User" ADD COLUMN     "callStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastStakeDay" TIMESTAMP(3);
