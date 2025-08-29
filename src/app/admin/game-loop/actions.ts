"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { simulateRound } from "@/app/actions/sim"

/** Hämta första spelbara runda (lägsta round med SCHEDULED) för given säsong */
async function computeNextRound(leagueId: string, season: number) {
  const next = await prisma.fixture.findFirst({
    where: { leagueId, season, status: "SCHEDULED" },
    orderBy: { round: "asc" },
    select: { round: true }
  })
  return next?.round ?? null
}

export async function scheduleNext(leagueId: string, minutesFromNow: number = 5) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, currentSeason: true, nextRound: true }
  })
  if (!league) return

  const nextRound = await computeNextRound(leagueId, league.currentSeason)
  const when = new Date(Date.now() + minutesFromNow * 60_000)

  await prisma.league.update({
    where: { id: leagueId },
    data: {
      nextRound: nextRound ?? league.nextRound,
      nextSimAt: when
    }
  })

  revalidatePath("/admin/game-loop")
  revalidatePath("/fixtures")
  revalidatePath("/fixtures/rounds")
  revalidatePath("/table")
}

export async function simulateNextNow(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, currentSeason: true }
  })
  if (!league) return

  // Beräkna säker nästa runda från DB
  let round = await computeNextRound(leagueId, league.currentSeason)
  if (!round) {
    // Inget kvar att spela – rensa ev. schema
    await prisma.league.update({
      where: { id: leagueId },
      data: { nextSimAt: null }
    })
    revalidatePath("/admin/game-loop")
    return
  }

  // Spela denna runda
  await simulateRound(leagueId, round)

  // Förbered nästa
  const after = await computeNextRound(leagueId, league.currentSeason)

  await prisma.league.update({
    where: { id: leagueId },
    data: {
      nextRound: after ?? round + 1,
      nextSimAt: null
    }
  })

  revalidatePath("/fixtures")
  revalidatePath("/fixtures/rounds")
  revalidatePath("/table")
  revalidatePath("/admin/game-loop")
}
