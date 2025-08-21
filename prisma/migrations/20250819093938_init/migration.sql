-- CreateEnum
CREATE TYPE "public"."MatchStatus" AS ENUM ('SCHEDULED', 'PLAYED');

-- CreateEnum
CREATE TYPE "public"."Position" AS ENUM ('GK', 'DF', 'MF', 'FW');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Club" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "leagueId" TEXT,
    "name" TEXT NOT NULL,
    "budget" INTEGER NOT NULL DEFAULT 1000,
    "reputation" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Player" (
    "id" TEXT NOT NULL,
    "clubId" TEXT,
    "age" INTEGER NOT NULL,
    "pos" "public"."Position" NOT NULL,
    "ovr" INTEGER NOT NULL,
    "pot" INTEGER NOT NULL,
    "stamina" INTEGER NOT NULL,
    "pace" INTEGER NOT NULL,
    "pass" INTEGER NOT NULL,
    "shoot" INTEGER NOT NULL,
    "defend" INTEGER NOT NULL,
    "gk" INTEGER NOT NULL,
    "morale" INTEGER NOT NULL DEFAULT 50,
    "personality" TEXT NOT NULL DEFAULT 'PROFESSIONAL',
    "wages" INTEGER NOT NULL DEFAULT 10,
    "contractUntil" INTEGER NOT NULL DEFAULT 2030,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tactic" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "styleJson" JSONB NOT NULL,

    CONSTRAINT "Tactic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingPlan" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "focusJson" JSONB NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Fixture" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeClubId" TEXT NOT NULL,
    "awayClubId" TEXT NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Match" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "resultJson" JSONB NOT NULL,
    "eventsJson" JSONB NOT NULL,
    "xgHome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xgAway" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferListing" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "askPrice" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "TransferListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Bid" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Player_clubId_idx" ON "public"."Player"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Tactic_clubId_key" ON "public"."Tactic"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlan_clubId_week_key" ON "public"."TrainingPlan"("clubId", "week");

-- CreateIndex
CREATE INDEX "Fixture_leagueId_round_idx" ON "public"."Fixture"("leagueId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "Match_fixtureId_key" ON "public"."Match"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferListing_playerId_key" ON "public"."TransferListing"("playerId");

-- CreateIndex
CREATE INDEX "Bid_listingId_idx" ON "public"."Bid"("listingId");

-- AddForeignKey
ALTER TABLE "public"."Club" ADD CONSTRAINT "Club_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Club" ADD CONSTRAINT "Club_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tactic" ADD CONSTRAINT "Tactic_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingPlan" ADD CONSTRAINT "TrainingPlan_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fixture" ADD CONSTRAINT "Fixture_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fixture" ADD CONSTRAINT "Fixture_homeClubId_fkey" FOREIGN KEY ("homeClubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fixture" ADD CONSTRAINT "Fixture_awayClubId_fkey" FOREIGN KEY ("awayClubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "public"."Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferListing" ADD CONSTRAINT "TransferListing_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferListing" ADD CONSTRAINT "TransferListing_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Bid" ADD CONSTRAINT "Bid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."TransferListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Bid" ADD CONSTRAINT "Bid_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
