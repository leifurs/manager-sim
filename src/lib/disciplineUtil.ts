// src/lib/disciplineUtil.ts
import { prisma } from "@/lib/prisma"

/**
 * Avstängningar inför en given omgång och säsong i ligan.
 */
export async function getSuspendedByClubForRound(leagueId: string, season: number, targetRound: number) {
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, season, round: { lt: targetRound } },
    include: { match: true },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }]
  })

  const playerClubCache = new Map<string, string | null>()
  const yellows = new Map<string, number>()
  const suspLeft = new Map<string, number>()

  async function getClubId(pid: string): Promise<string | null> {
    if (playerClubCache.has(pid)) return playerClubCache.get(pid) ?? null
    const p = await prisma.player.findUnique({ where: { id: pid }, select: { clubId: true } })
    const cid = p?.clubId ?? null
    playerClubCache.set(pid, cid)
    return cid
  }

  for (const f of fixtures) {
    const events: Array<any> | undefined = (f.match as any)?.eventsJson

    // minska kvarvarande spärr för klubbar som spelade
    for (const [pid, left] of [...suspLeft.entries()]) {
      if (left <= 0) continue
      const cid = await getClubId(pid)
      if (cid && (cid === f.homeClubId || cid === f.awayClubId)) {
        const next = left - 1
        if (next <= 0) suspLeft.delete(pid)
        else suspLeft.set(pid, next)
      }
    }

    if (!events) continue

    for (const e of events) {
      if (e?.type !== "CARD_YELLOW" && e?.type !== "CARD_RED") continue
      const pid: string | undefined = e.playerId
      if (!pid) continue

      if (e.type === "CARD_YELLOW") {
        const cur = yellows.get(pid) ?? 0
        const nxt = cur + 1
        yellows.set(pid, nxt)
        if (nxt % 3 === 0) suspLeft.set(pid, (suspLeft.get(pid) ?? 0) + 1)
      } else if (e.type === "CARD_RED") {
        suspLeft.set(pid, (suspLeft.get(pid) ?? 0) + 1)
      }
    }
  }

  // Lag som spelar i targetRound (samma säsong)
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
  for (const [pid, left] of suspLeft.entries()) {
    if (left <= 0) continue
    const cid = await getClubId(pid)
    if (!cid || !playing.has(cid)) continue
    if (!result.has(cid)) result.set(cid, new Set<string>())
    result.get(cid)!.add(pid)
  }
  return result
}

/** Avstängda i specifik fixture (hämtar säsong från fixture). */
export async function getSuspendedForFixture(fixtureId: string) {
  const fx = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: { leagueId: true, season: true, round: true, homeClubId: true, awayClubId: true }
  })
  if (!fx) return { home: new Set<string>(), away: new Set<string>() }

  const byClub = await getSuspendedByClubForRound(fx.leagueId, fx.season, fx.round)
  return {
    home: byClub.get(fx.homeClubId) ?? new Set<string>(),
    away: byClub.get(fx.awayClubId) ?? new Set<string>()
  }
}

/** Avstängda i NÄSTA schemalagda match för en klubb (rätt säsong) */
export async function getSuspendedForNextFixtureOfClub(clubId: string) {
  const nextFx = await prisma.fixture.findFirst({
    where: { status: "SCHEDULED", OR: [{ homeClubId: clubId }, { awayClubId: clubId }] },
    orderBy: [{ season: "desc" }, { round: "asc" }, { kickoffAt: "asc" }],
    select: { leagueId: true, season: true, round: true }
  })
  if (!nextFx) return new Set<string>()
  const byClub = await getSuspendedByClubForRound(nextFx.leagueId, nextFx.season, nextFx.round)
  return byClub.get(clubId) ?? new Set<string>()
}

/** Badge i listor: finns avstängda i denna match? */
export async function hasSuspendedForFixture(fixtureId: string): Promise<boolean> {
  const s = await getSuspendedForFixture(fixtureId)
  return s.home.size > 0 || s.away.size > 0
}
