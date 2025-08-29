-- DropIndex
DROP INDEX "public"."Fixture_leagueId_round_idx";

-- AlterTable
ALTER TABLE "public"."Fixture" ADD COLUMN     "season" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN     "season" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Fixture_leagueId_season_round_idx" ON "public"."Fixture"("leagueId", "season", "round");
