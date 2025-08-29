import { prisma } from "@/lib/prisma"

export type KeeperRow = {
  playerId: string
  playerName: string
  clubName: string
  cleanSheets: number
}

export async function getTopKeepers(leagueId: string, limit = 50): Promise<KeeperRow[]> {
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, status: "PLAYED" },
    include: { match: true, homeClub: true, awayClub: true },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }]
  })

  const map = new Map<string, { name?: string; club: string; cleanSheets: number }>()
  const toLookup = new Set<string>()

  for (const f of fixtures) {
    const events = (f.match as any)?.eventsJson as any[] | undefined
    const res = (f.match as any)?.resultJson as { home: number; away: number } | undefined
    if (!events || !res) continue

    const homeLine = events.find(e => e.type === "LINEUP" && e.team === "HOME")?.playerIds as string[] | undefined
    const awayLine = events.find(e => e.type === "LINEUP" && e.team === "AWAY")?.playerIds as string[] | undefined
    if (!homeLine || !awayLine) continue

    // Hämta GKs för bägge elvor (enkel: ta de i elvan som har pos==GK)
    // Vi måste slå upp pos via DB.
    const players = await prisma.player.findMany({
      where: { id: { in: [...homeLine, ...awayLine] } },
      select: { id: true, name: true, pos: true, clubId: true }
    })
    const homeGK = players.find(p => homeLine.includes(p.id) && p.pos === "GK")
    const awayGK = players.find(p => awayLine.includes(p.id) && p.pos === "GK")

    if (homeGK && res.away === 0) {
      toLookup.add(homeGK.id)
      const cur = map.get(homeGK.id) ?? { name: homeGK.name, club: f.homeClub.name, cleanSheets: 0 }
      cur.cleanSheets++
      map.set(homeGK.id, cur)
    }
    if (awayGK && res.home === 0) {
      toLookup.add(awayGK.id)
      const cur = map.get(awayGK.id) ?? { name: awayGK.name, club: f.awayClub.name, cleanSheets: 0 }
      cur.cleanSheets++
      map.set(awayGK.id, cur)
    }
  }

  return Array.from(map.entries())
    .map(([playerId, v]) => ({ playerId, playerName: v.name ?? "Okänd spelare", clubName: v.club, cleanSheets: v.cleanSheets }))
    .sort((a, b) => b.cleanSheets - a.cleanSheets || a.playerName.localeCompare(b.playerName))
    .slice(0, limit)
}
