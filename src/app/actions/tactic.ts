"use server"

import { prisma } from "@/lib/prisma"
import { TacticInputSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export async function updateTactic(input: unknown) {
  const parsed = TacticInputSchema.safeParse(input)
  if (!parsed.success) {
    // logga för felsökning i dev
    console.error("Tactic validation error:", parsed.error.flatten())
    return { error: "Ogiltig input" }
  }

  const { clubId, formation, style } = parsed.data

  try {
    await prisma.tactic.upsert({
      where: { clubId },
      update: { formation, styleJson: style },
      create: { clubId, formation, styleJson: style }
    })

    revalidatePath(`/clubs/${clubId}`)
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Kunde inte spara taktik" }
  }
}
