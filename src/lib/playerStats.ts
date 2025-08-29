// src/lib/playerStats.ts
import { prisma } from "@/lib/prisma"

export type PlayerStats = {
  playerId: string
  playerName: string
  clubId: string | null
  clubName: string | null

  appearances: number
  goals: number
  assists: number
  yellows: number
  reds: number
  cleanSheets: number

  lastEvents: Array<{
    minute: number
    type: string
    vs: string
    round: number
    team: "HOME" | "AWAY"
  }>

  ratings: Array<{ round: number; vs: string; rating: number; notes: string[] }>
  avgRating: number | null
  last5Avg: number | null
}

/**
 * Rating + förklarande noter.
 */
function calcRatingWithNotes(opts: {
  side: "HOME" | "AWAY"
  res: { home: number; away: number }
  isGK: boolean
  played: boolean

  goals: number
  assists: number
  yellows: number
  reds: number
  cleanSheet: boolean

  tactic?: any // { tempo?: number; press?: number; line?: number }
}) {
  if (!opts.played) return { rating: null as number | null, notes: ["Spelade ej"] }

  let r = 6.5
  const notes: string[] = ["Bas 6.5"]

  // Resultat
  const won = (opts.side === "HOME" && opts.res.home > opts.res.away) || (opts.side === "AWAY" && opts.res.away > opts.res.home)
  const draw = opts.res.home === opts.res.away
  if (won) {
    r += 0.3
    notes.push("+0.3 Vinst")
  } else if (!draw) {
    r -= 0.2
    notes.push("−0.2 Förlust")
  }

  // Prestation
  if (opts.goals) {
    r += opts.goals * 1.0
    notes.push(`+${(opts.goals * 1.0).toFixed(1)} Mål x${opts.goals}`)
  }
  if (opts.assists) {
    r += opts.assists * 0.7
    notes.push(`+${(opts.assists * 0.7).toFixed(1)} Assist x${opts.assists}`)
  }
  if (opts.yellows) {
    r -= opts.yellows * 0.7
    notes.push(`−${(opts.yellows * 0.7).toFixed(1)} Gula x${opts.yellows}`)
  }
  if (opts.reds) {
    r -= opts.reds * 1.5
    notes.push(`−${(opts.reds * 1.5).toFixed(1)} Röda x${opts.reds}`)
  }

  // GK clean sheet
  if (opts.isGK && opts.cleanSheet) {
    r += 0.5
    notes.push("+0.5 Nolla (GK)")
  }

  // Taktikpåverkan
  const style = (opts.tactic ?? {}) as { tempo?: number; press?: number; line?: number }
  const tempo = Number(style.tempo ?? 0.5)
  const press = Number(style.press ?? 0.5)
  const line = Number(style.line ?? 0.5)

  if (!opts.isGK && tempo >= 0.6 && opts.goals > 0) {
    const bonus = 0.2 * opts.goals
    r += bonus
    notes.push(`+${bonus.toFixed(1)} Offensiv tempo-bonus`)
  }
  if (!opts.isGK && press >= 0.6) {
    const pressBonus = Math.min(0.2, 0.1 * (opts.goals + opts.assists))
    if (pressBonus > 0) {
      r += pressBonus
      notes.push(`+${pressBonus.toFixed(1)} Hög press-bonus`)
    }
  }
  if (opts.isGK && opts.cleanSheet && line >= 0.6) {
    r += 0.2
    notes.push("+0.2 Hög backlinje-bonus (GK)")
  }

  // Klipp & runda
  if (r < 4.0) r = 4.0
  if (r > 10.0) r = 10.0
  r = Math.round(r * 100) / 100

  return { rating: r, notes }
}

export async function getPlayerStats(playerId: string): Promise<PlayerStats | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { club: true }
  })
  if (!player) return null

  const fixtures = await prisma.fixture.findMany({
    where: {
      OR: [{ homeClubId: player.clubId ?? "" }, { awayClubId: player.clubId ?? "" }],
      status: "PLAYED"
    },
    include: {
      match: true,
      homeClub: { include: { tactic: true } },
      awayClub: { include: { tactic: true } }
    },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }]
  })

  let appearances = 0,
    goals = 0,
    assists = 0,
    yellows = 0,
    reds = 0,
    cleanSheets = 0

  const lastEvents: PlayerStats["lastEvents"] = []
  const ratings: Array<{ round: number; vs: string; rating: number; notes: string[] }> = []

  for (const f of fixtures) {
    const m = f.match as any
    const events: any[] | undefined = m?.eventsJson
    const res: { home: number; away: number } | undefined = m?.resultJson
    if (!events || !res) continue

    const side: "HOME" | "AWAY" | null = f.homeClubId === player.clubId ? "HOME" : f.awayClubId === player.clubId ? "AWAY" : null
    if (!side) continue

    const tactic = side === "HOME" ? (f.homeClub.tactic?.styleJson as any) : (f.awayClub.tactic?.styleJson as any)
    const vsName = side === "HOME" ? f.awayClub.name : f.homeClub.name

    // Spelade?
    const lu = events.find(e => e.type === "LINEUP" && e.team === side)
    const playedThis = Boolean(lu && Array.isArray(lu.playerIds) && lu.playerIds.includes(playerId))
    if (playedThis) appearances++

    // Summera händelser denna match
    let g = 0,
      a = 0,
      y = 0,
      r = 0
    for (const e of events) {
      if (e.team !== side) continue
      if (e.type === "GOAL" && e.playerId === playerId) {
        g++
        lastEvents.push({ minute: e.minute, type: "Mål", vs: vsName, round: f.round, team: side })
      }
      if (e.type === "GOAL" && e.assistPlayerId === playerId) {
        a++
        lastEvents.push({ minute: e.minute, type: "Assist", vs: vsName, round: f.round, team: side })
      }
      if (e.type === "CARD_YELLOW" && e.playerId === playerId) {
        y++
        lastEvents.push({ minute: e.minute, type: "Gult kort", vs: vsName, round: f.round, team: side })
      }
      if (e.type === "CARD_RED" && e.playerId === playerId) {
        r++
        lastEvents.push({ minute: e.minute, type: "Rött kort", vs: vsName, round: f.round, team: side })
      }
    }
    goals += g
    assists += a
    yellows += y
    reds += r

    // Clean sheet för GK
    let cs = false
    if (playedThis && player.pos === "GK") {
      cs = (side === "HOME" && res.away === 0) || (side === "AWAY" && res.home === 0)
      if (cs) cleanSheets++
    }

    // Rating + noter
    const { rating, notes } = calcRatingWithNotes({
      side,
      res,
      isGK: player.pos === "GK",
      played: playedThis,
      goals: g,
      assists: a,
      yellows: y,
      reds: r,
      cleanSheet: cs,
      tactic
    })
    if (rating != null) ratings.push({ round: f.round, vs: vsName, rating, notes })
  }

  // Sortera senaste händelser
  lastEvents.sort((x, y) => y.round - x.round || y.minute - x.minute)
  lastEvents.splice(12)

  const avg = ratings.length ? Math.round((ratings.reduce((s, x) => s + x.rating, 0) / ratings.length) * 100) / 100 : null
  const last5 = ratings.slice(-5)
  const last5Avg = last5.length ? Math.round((last5.reduce((s, x) => s + x.rating, 0) / last5.length) * 100) / 100 : null

  return {
    playerId: player.id,
    playerName: player.name,
    clubId: player.clubId ?? null,
    clubName: player.club?.name ?? null,
    appearances,
    goals,
    assists,
    yellows,
    reds,
    cleanSheets,
    lastEvents,
    ratings,
    avgRating: avg,
    last5Avg
  }
}
