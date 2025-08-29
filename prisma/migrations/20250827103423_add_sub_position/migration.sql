-- CreateEnum
CREATE TYPE "public"."SubPosition" AS ENUM ('GK', 'CB', 'LB', 'RB', 'CM', 'DM', 'AM', 'ST', 'LW', 'RW');

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "subPos" "public"."SubPosition" NOT NULL DEFAULT 'GK';
