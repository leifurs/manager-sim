import { prisma } from "@/lib/prisma"

export type StandingRow = {
  clubId: string
  clubName: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  pts: number
  form: string // "V O F V V"
  ppg: number // ⬅️ nytt: poäng per match
}

function emptyRow(clubId: string, clubName: string): StandingRow {
  return {
    clubId,
    clubName,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
    form: "",
    ppg: 0
  }
}

export async function getLeagueTable(leagueId: string): Promise<StandingRow[]> {
  const clubs = await prisma.club.findMany({
    where: { leagueId },
    select: { id: true, name: true }
  })

  const rows = new Map<string, StandingRow>()
  for (const c of clubs) rows.set(c.id, emptyRow(c.id, c.name))

  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, status: "PLAYED" },
    include: { match: true },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }]
  })

  const seq = new Map<string, string[]>()

  for (const f of fixtures) {
    const res = (f.match as any)?.resultJson as { home: number; away: number } | undefined
    if (!res) continue

    const h = rows.get(f.homeClubId)!
    const a = rows.get(f.awayClubId)!

    h.played++
    a.played++
    h.gf += res.home
    h.ga += res.away
    a.gf += res.away
    a.ga += res.home

    if (res.home > res.away) {
      h.won++
      a.lost++
      h.pts += 3
      ;(seq.get(f.homeClubId) ?? seq.set(f.homeClubId, []).get(f.homeClubId)!)?.push("V")
      ;(seq.get(f.awayClubId) ?? seq.set(f.awayClubId, []).get(f.awayClubId)!)?.push("F")
    } else if (res.home < res.away) {
      a.won++
      h.lost++
      a.pts += 3
      ;(seq.get(f.homeClubId) ?? seq.set(f.homeClubId, []).get(f.homeClubId)!)?.push("F")
      ;(seq.get(f.awayClubId) ?? seq.set(f.awayClubId, []).get(f.awayClubId)!)?.push("V")
    } else {
      h.drawn++
      a.drawn++
      h.pts += 1
      a.pts += 1
      ;(seq.get(f.homeClubId) ?? seq.set(f.homeClubId, []).get(f.homeClubId)!)?.push("O")
      ;(seq.get(f.awayClubId) ?? seq.set(f.awayClubId, []).get(f.awayClubId)!)?.push("O")
    }
  }

  for (const r of rows.values()) {
    r.gd = r.gf - r.ga
    r.ppg = r.played ? Math.round((r.pts / r.played) * 100) / 100 : 0 // två decimaler
  }

  for (const [clubId, s] of seq.entries()) {
    const r = rows.get(clubId)
    if (!r) continue
    r.form = s.slice(-5).join(" ")
  }

  // sortera fortfarande på pts, gd, gf, namn (PPG visas men styr ej sorteringen)
  return Array.from(rows.values()).sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.clubName.localeCompare(y.clubName))
}

export async function getDefaultLeagueId(): Promise<string | null> {
  const league = await prisma.league.findFirst({ orderBy: { tier: "asc" } })
  return league?.id ?? null
}
