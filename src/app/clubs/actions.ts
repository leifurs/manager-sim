"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function takeOverClub(clubId: string) {
  const session = await auth()
  if (!session?.user?.email) {
    throw new Error("Du måste vara inloggad.")
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) throw new Error("Ingen användare.")

  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { userId: true } })
  if (!club) throw new Error("Klubb saknas.")
  if (club.userId && club.userId !== user.id) {
    throw new Error("Klubben styrs redan av en annan manager.")
  }

  await prisma.club.update({
    where: { id: clubId },
    data: { userId: user.id }
  })

  revalidatePath(`/clubs/${clubId}`)
  revalidatePath(`/clubs`)
}
