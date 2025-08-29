import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut
} = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Namn", type: "text" }
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase()
        const name = String(creds?.name ?? "Manager")

        if (!email) return null

        let user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          user = await prisma.user.create({ data: { email, name } })
        }
        return { id: user.id, email: user.email, name: user.name ?? "Manager" }
      }
    })
  ],
  pages: {
    signIn: "/login"
  }
})
