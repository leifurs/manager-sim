/*
  Warnings:

  - A unique constraint covering the columns `[leagueId,name]` on the table `Club` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,tier,country]` on the table `League` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Club_leagueId_name_key" ON "public"."Club"("leagueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "League_name_tier_country_key" ON "public"."League"("name", "tier", "country");
