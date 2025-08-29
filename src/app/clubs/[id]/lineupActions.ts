"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function saveLineup(clubId: string, formation: string, lineup: Record<string, string[]>) {
  await prisma.tactic.upsert({
    where: { clubId },
    update: { formation, styleJson: { formation, lineup } },
    create: { clubId, formation, styleJson: { formation, lineup } }
  })

  revalidatePath(`/clubs/${clubId}`)
}
