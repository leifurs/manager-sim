"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentSeasonNumber, nextSeasonStart } from "@/lib/season"

/** Skapar ny säsong i ligan: genererar nya fixtures. */
export async function startNewSeason(leagueId: string) {
  // Hämta klubbar i ligan
  const clubs = await prisma.club.findMany({
    where: { leagueId },
    select: { id: true },
    orderBy: { name: "asc" }
  })
  if (clubs.length < 2) return { error: "För få klubbar i ligan." }

  const current = await getCurrentSeasonNumber(leagueId)
  const newSeason = current + 1
  const start = await nextSeasonStart(leagueId)

  // Circle method (enkel enkelmöte)
  const ids = clubs.map(c => c.id)
  const n = ids.length
  const half = Math.floor(n / 2)
  let home = ids.slice(0, half)
  let away = ids.slice(half).reverse()

  const data: any[] = []
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < half; i++) {
      const kickoff = new Date(start.getTime())
      kickoff.setDate(kickoff.getDate() + r * 7)
      data.push({
        leagueId,
        season: newSeason,
        round: r + 1,
        kickoffAt: kickoff,
        homeClubId: home[i],
        awayClubId: away[i]
      })
    }
    // rotate (förutom första hemma)
    if (n > 2) {
      const fixed = home[0]
      const movedFromHome = home.splice(1, 1)[0]
      const movedFromAway = away.pop()!
      home.push(movedFromAway)
      away.unshift(movedFromHome)
      home[0] = fixed
    }
  }

  await prisma.fixture.createMany({ data })
  revalidatePath("/fixtures")
  revalidatePath("/fixtures/rounds")
  revalidatePath("/table")
  return { ok: true, season: newSeason }
}
