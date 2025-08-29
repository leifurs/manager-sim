// src/lib/injuryUtil.ts
import { prisma } from "@/lib/prisma"

/**
 * Aktiva skador inför en given omgång/säsong.
 * Vi går match för match t.o.m. targetRound-1:
 *  - Decrement på pågående skador för lag som spelat.
 *  - Nya INJURY-event adderar gamesOut matcher.
 * Return: Map<clubId, Set<playerId>> (skadade i targetRound).
 */
export async function getInjuredByClubForRound(leagueId: string, season: number, targetRound: number) {
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, season, round: { lt: targetRound } },
    include: { match: true },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }]
  })

  const injuryLeft = new Map<string, number>() // playerId -> matches left
  const playerClubCache = new Map<string, string | null>()
  async function getClubId(pid: string): Promise<string | null> {
    if (playerClubCache.has(pid)) return playerClubCache.get(pid) ?? null
    const p = await prisma.player.findUnique({ where: { id: pid }, select: { clubId: true } })
    const cid = p?.clubId ?? null
    playerClubCache.set(pid, cid)
    return cid
  }

  for (const f of fixtures) {
    const events: Array<any> | undefined = (f.match as any)?.eventsJson

    // 1) Decrement för spelare vars lag spelade denna match
    for (const [pid, left] of [...injuryLeft.entries()]) {
      if (left <= 0) continue
      const cid = await getClubId(pid)
      if (cid && (cid === f.homeClubId || cid === f.awayClubId)) {
        const next = left - 1
        if (next <= 0) injuryLeft.delete(pid)
        else injuryLeft.set(pid, next)
      }
    }

    if (!events) continue

    // 2) Nya skador från denna match
    for (const e of events) {
      if (e?.type !== "INJURY") continue
      const pid: string | undefined = e.playerId
      const out = Math.max(1, Math.min(10, Number(e.gamesOut ?? 1)))
      if (!pid) continue
      injuryLeft.set(pid, (injuryLeft.get(pid) ?? 0) + out)
    }
  }

  // Vilka klubbar spelar i targetRound?
  const roundFixtures = await prisma.fixture.findMany({
    where: { leagueId, season, round: targetRound },
    select: { homeClubId: true, awayClubId: true }
  })
  const playing = new Set<string>()
  for (const rf of roundFixtures) {
    playing.add(rf.homeClubId)
    playing.add(rf.awayClubId)
  }

  const result = new Map<string, Set<string>>()
  for (const [pid, left] of injuryLeft.entries()) {
    if (left <= 0) continue
    const cid = await getClubId(pid)
    if (!cid || !playing.has(cid)) continue
    if (!result.has(cid)) result.set(cid, new Set<string>())
    result.get(cid)!.add(pid)
  }
  return result
}

/** Skadade i en specifik fixture (läser säsong & omgång från fixture). */
export async function getInjuredForFixture(fixtureId: string) {
  const fx = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: { leagueId: true, season: true, round: true, homeClubId: true, awayClubId: true }
  })
  if (!fx) return { home: new Set<string>(), away: new Set<string>() }

  const byClub = await getInjuredByClubForRound(fx.leagueId, fx.season, fx.round)
  return {
    home: byClub.get(fx.homeClubId) ?? new Set<string>(),
    away: byClub.get(fx.awayClubId) ?? new Set<string>()
  }
}

/** Skadade i NÄSTA schemalagda match för en klubb (rätt säsong). */
export async function getInjuredForNextFixtureOfClub(clubId: string) {
  const nextFx = await prisma.fixture.findFirst({
    where: { status: "SCHEDULED", OR: [{ homeClubId: clubId }, { awayClubId: clubId }] },
    orderBy: [{ season: "desc" }, { round: "asc" }, { kickoffAt: "asc" }],
    select: { leagueId: true, season: true, round: true }
  })
  if (!nextFx) return new Set<string>()
  const byClub = await getInjuredByClubForRound(nextFx.leagueId, nextFx.season, nextFx.round)
  return byClub.get(clubId) ?? new Set<string>()
}

/** Badge i listor: finns skadade i denna match? */
export async function hasInjuredForFixture(fixtureId: string): Promise<boolean> {
  const s = await getInjuredForFixture(fixtureId)
  return s.home.size > 0 || s.away.size > 0
}
