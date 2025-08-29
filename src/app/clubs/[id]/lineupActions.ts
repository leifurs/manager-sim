"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { canEditLineupNow } from "@/lib/lineupLock"

export async function saveLineup(clubId: string, formation: string, lineup: Record<string, string[]>) {
  const ok = await canEditLineupNow(clubId)
  if (!ok) {
    // kasta ett kontrollerat fel → fångas av klient (du visar t.ex. en toast)
    throw new Error("Lineup är låst inför nästa match. Prova efter att omgången spelats.")
  }

  await prisma.tactic.upsert({
    where: { clubId },
    update: { formation, styleJson: { formation, lineup } },
    create: { clubId, formation, styleJson: { formation, lineup } }
  })

  revalidatePath(`/clubs/${clubId}`)
}
