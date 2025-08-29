import { prisma } from "@/lib/prisma"

export type AssistRow = {
  playerId: string
  playerName: string
  clubName: string
  assists: number
}

export async function getTopAssists(leagueId: string, limit = 50): Promise<AssistRow[]> {
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, status: "PLAYED" },
    include: { match: true, homeClub: true, awayClub: true }
  })

  const map = new Map<string, { name?: string; club: string; assists: number }>()
  const lookup = new Set<string>()

  for (const f of fixtures) {
    const events = (f.match as any)?.eventsJson as any[] | undefined
    if (!events) continue

    for (const e of events) {
      if (e.type !== "GOAL" || !e.assistPlayerId) continue
      const club = e.team === "HOME" ? f.homeClub.name : f.awayClub.name
      const isPlaceholder = !e.assistPlayerName || String(e.assistPlayerName).startsWith("#")
      if (isPlaceholder) lookup.add(e.assistPlayerId)

      const cur = map.get(e.assistPlayerId) ?? { name: e.assistPlayerName, club, assists: 0 }
      cur.assists++
      if (e.assistPlayerName && !isPlaceholder) cur.name = e.assistPlayerName
      map.set(e.assistPlayerId, cur)
    }
  }

  if (lookup.size) {
    const players = await prisma.player.findMany({
      where: { id: { in: Array.from(lookup) } },
      select: { id: true, name: true }
    })
    const nameMap = new Map(players.map(p => [p.id, p.name]))
    for (const [pid, row] of map) if (nameMap.has(pid)) row.name = nameMap.get(pid)!
  }

  return Array.from(map.entries())
    .map(([playerId, v]) => ({ playerId, playerName: v.name ?? "Okänd spelare", clubName: v.club, assists: v.assists }))
    .sort((a, b) => b.assists - a.assists || a.playerName.localeCompare(b.playerName))
    .slice(0, limit)
}
