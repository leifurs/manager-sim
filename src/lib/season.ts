// src/lib/season.ts
import { prisma } from "@/lib/prisma"

/** Senaste säsongsnummer i ligan, fallback 1 om inga fixtures. */
export async function getCurrentSeasonNumber(leagueId: string): Promise<number> {
  const row = await prisma.fixture.aggregate({
    where: { leagueId },
    _max: { season: true }
  })
  return row._max.season ?? 1
}

/** Startdatum för nästa säsong (vecka efter sista kickoff i nuv. säsong) */
export async function nextSeasonStart(leagueId: string): Promise<Date> {
  const cur = await getCurrentSeasonNumber(leagueId)
  const last = await prisma.fixture.aggregate({
    where: { leagueId, season: cur },
    _max: { kickoffAt: true }
  })
  const base = last._max.kickoffAt ?? new Date()
  const d = new Date(base)
  d.setDate(d.getDate() + 7)
  return d
}
