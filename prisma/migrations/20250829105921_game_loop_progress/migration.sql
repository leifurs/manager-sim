-- AlterTable
ALTER TABLE "public"."League" ADD COLUMN     "currentSeason" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nextRound" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nextSimAt" TIMESTAMP(3);
