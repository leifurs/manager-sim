import { prisma } from "@/lib/prisma"

export type ScorerRow = {
  playerId: string
  playerName: string
  clubName: string
  goals: number
}

export async function getTopScorers(leagueId: string, limit = 50): Promise<ScorerRow[]> {
  // Hämta spelade fixtures i ligan med events
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, status: "PLAYED" },
    include: { match: true, homeClub: true, awayClub: true }
  })

  const goalsByPlayer = new Map<string, { name: string; club: string; goals: number }>()

  for (const f of fixtures) {
    const events = (f.match as any)?.eventsJson as Array<{ type: string; team: "HOME" | "AWAY"; playerId?: string; playerName?: string }> | undefined
    if (!events) continue

    for (const e of events) {
      if (e.type !== "GOAL") continue
      const pid = e.playerId ?? `${f.id}-${Math.random()}` // fallback
      const pname = e.playerName ?? (e.team === "HOME" ? f.homeClub.name : f.awayClub.name)
      const club = e.team === "HOME" ? f.homeClub.name : f.awayClub.name

      const cur = goalsByPlayer.get(pid) ?? { name: pname, club, goals: 0 }
      cur.goals += 1
      goalsByPlayer.set(pid, cur)
    }
  }

  return Array.from(goalsByPlayer.entries())
    .map(([playerId, v]) => ({ playerId, playerName: v.name, clubName: v.club, goals: v.goals }))
    .sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName))
    .slice(0, limit)
}
