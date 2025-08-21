import { prisma } from "@/lib/prisma"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Klubbar | ManagerSim",
  description: "Lista över alla klubbar i ligan."
}

export default async function ClubsPage() {
  const clubs = await prisma.club.findMany({
    include: { _count: { select: { players: true } }, league: true },
    orderBy: { name: "asc" }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Klubbar</h1>

      {clubs.length === 0 && (
        <p>
          Inga klubbar ännu. Kör <code>pnpm db:seed</code> eller skapa data.
        </p>
      )}

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map(c => (
          <li key={c.id}>
            <div
              className="rounded-xl border bg-white p-4 shadow-sm transition
                         hover:shadow-md focus-within:shadow-md
                         dark:bg-zinc-900 dark:border-zinc-800"
            >
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Liga: {c.league?.name ?? "–"} · Spelare: {c._count.players}
                </p>
              </div>

              <div className="mt-3">
                <Link
                  href={`/clubs/${c.id}`}
                  className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm
                             border-zinc-300 text-zinc-800 hover:bg-zinc-50
                             dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Visa trupp
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
