// src/lib/injuries.ts
import { prisma } from "@/lib/prisma"
import { MatchStatus } from "@prisma/client"

type InjuryEvent = {
  type: "INJURY"
  minute: number
  team: "HOME" | "AWAY"
  playerId: string
  playerName?: string
  gamesOut: number
}

export async function getCurrentInjuriesForClub(clubId: string) {
  // Hämta alla klubbinterna matcher (spelas i ordning)
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: MatchStatus.PLAYED,
      OR: [{ homeClubId: clubId }, { awayClubId: clubId }]
    },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }],
    select: {
      id: true,
      round: true,
      homeClubId: true,
      awayClubId: true,
      match: { select: { eventsJson: true } }
    }
  })

  // karta över "matcher kvar att missa" per spelare
  const remaining = new Map<string, number>()

  for (const f of fixtures) {
    // 1) spelad match -> alla aktiva skador räknas ner en (om > 0)
    for (const [pid, left] of [...remaining.entries()]) {
      if (left > 0) remaining.set(pid, left - 1)
    }

    // 2) lägg till skador från denna match
    const events = (f.match?.eventsJson as any[]) ?? []
    for (const e of events as InjuryEvent[]) {
      if (e?.type !== "INJURY") continue
      const isHome = f.homeClubId === clubId
      const isAway = f.awayClubId === clubId
      if ((e.team === "HOME" && isHome) || (e.team === "AWAY" && isAway)) {
        const prev = remaining.get(e.playerId) ?? 0
        remaining.set(e.playerId, prev + Math.max(0, e.gamesOut || 0))
      }
    }
  }

  // Filtrera de som fortfarande har > 0 kvar
  const activeIds = [...remaining.entries()].filter(([, left]) => left > 0).map(([pid]) => pid)

  if (activeIds.length === 0) return []

  const players = await prisma.player.findMany({
    where: { id: { in: activeIds } },
    select: { id: true, name: true, pos: true, subPos: true }
  })

  // slå ihop med kvarvarande matcher
  const leftById = new Map(remaining)
  return players
    .map(p => ({
      id: p.id,
      name: (p as any).name ?? "Okänd",
      pos: p.pos,
      subPos: (p as any).subPos ?? null,
      gamesRemaining: leftById.get(p.id) ?? 0
    }))
    .sort((a, b) => b.gamesRemaining - a.gamesRemaining)
}
