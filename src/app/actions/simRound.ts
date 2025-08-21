"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { simulateFixture } from "./sim"

export async function simulateRound(leagueId: string, round: number) {
  // Hämta ospelade fixtures i omgången
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, round, status: "SCHEDULED" },
    select: { id: true }
  })

  if (fixtures.length === 0) {
    return { ok: true, message: "Inga ospelade matcher i denna omgång." }
  }

  // Kör en i taget (enkelt och deterministiskt)
  for (const f of fixtures) {
    await simulateFixture(f.id)
  }

  // Revalidera relevanta sidor
  revalidatePath("/fixtures")
  revalidatePath("/table")
  return { ok: true, played: fixtures.length }
}
