import { prisma } from "@/lib/prisma"

/**
 * Returnerar true om lineup får ändras för en klubb JUST NU.
 * Logik:
 * - Hämta klubbens liga
 * - Om league.nextSimAt finns: lås X min före nextSimAt
 * - Annars hämta klubbens nästa SCHEDULED-fixture -> lås X min före kickoffAt
 */
export async function canEditLineupNow(clubId: string): Promise<boolean> {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { leagueId: true }
  })
  if (!club?.leagueId) return true

  const league = await prisma.league.findUnique({
    where: { id: club.leagueId },
    select: { nextSimAt: true, lineupCutoffMins: true, id: true }
  })
  const cutoffMins = league?.lineupCutoffMins ?? 30
  const now = Date.now()

  // 1) Om ligan har schemalagd sim -> använd den
  if (league?.nextSimAt) {
    const lockAt = new Date(league.nextSimAt).getTime() - cutoffMins * 60_000
    return now < lockAt
  }

  // 2) Annars: nästa SCHEDULED-fixture för klubben
  const nextFx = await prisma.fixture.findFirst({
    where: {
      leagueId: league?.id,
      status: "SCHEDULED",
      OR: [{ homeClubId: clubId }, { awayClubId: clubId }]
    },
    orderBy: [{ season: "asc" }, { round: "asc" }, { kickoffAt: "asc" }],
    select: { kickoffAt: true }
  })
  if (!nextFx?.kickoffAt) return true

  const lockAt = new Date(nextFx.kickoffAt).getTime() - cutoffMins * 60_000
  return now < lockAt
}
