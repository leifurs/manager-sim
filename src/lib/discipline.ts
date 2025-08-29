import { prisma } from "@/lib/prisma"

export type DisciplineRow = {
  playerId: string
  playerName: string
  clubName: string
  yellows: number
  reds: number
}

export async function getDiscipline(leagueId: string, limit = 100): Promise<DisciplineRow[]> {
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, status: "PLAYED" },
    include: { match: true, homeClub: true, awayClub: true }
  })

  const map = new Map<string, { name?: string; club: string; y: number; r: number }>()

  for (const f of fixtures) {
    const events = (f.match as any)?.eventsJson as any[] | undefined
    if (!events) continue

    for (const e of events) {
      if (e.type !== "CARD_YELLOW" && e.type !== "CARD_RED") continue
      const club = e.team === "HOME" ? f.homeClub.name : f.awayClub.name
      if (!e.playerId) continue

      const cur = map.get(e.playerId) ?? { name: e.playerName, club, y: 0, r: 0 }
      if (e.type === "CARD_YELLOW") cur.y++
      else cur.r++
      if (e.playerName && String(e.playerName).length) cur.name = e.playerName
      map.set(e.playerId, cur)
    }
  }

  return Array.from(map.entries())
    .map(([playerId, v]) => ({ playerId, playerName: v.name ?? "Okänd spelare", clubName: v.club, yellows: v.y, reds: v.r }))
    .sort((a, b) => b.reds - a.reds || b.yellows - a.yellows || a.playerName.localeCompare(b.playerName))
    .slice(0, limit)
}
