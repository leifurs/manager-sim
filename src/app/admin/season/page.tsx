// src/app/admin/season/page.tsx
import { prisma } from "@/lib/prisma"
import { startNewSeason } from "@/app/actions/season"
import { getCurrentSeasonNumber } from "@/lib/season"

export default async function SeasonAdminPage() {
  // Ta tier 1 om den finns, annars första bästa
  const league = (await prisma.league.findFirst({ where: { tier: 1 } })) ?? (await prisma.league.findFirst())

  // Om ingen liga finns: visa info och avbryt
  if (!league) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Säsongshantering</h1>
        <div className="card">
          <p>Ingen liga hittades. Skapa en liga först (via seed eller Prisma Studio).</p>
        </div>
      </div>
    )
  }

  const leagueId = league.id // garanterat def här
  const cur = await getCurrentSeasonNumber(leagueId)

  // Server action behöver ligga i samma komponentfil; använd leagueId (inte league?.id)
  async function startAction() {
    "use server"
    await startNewSeason(leagueId)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Säsongshantering</h1>

      <div className="card">
        <div>
          Aktuell liga: <b>{league.name}</b>
        </div>
        <div>
          Nuvarande säsong: <b>{cur}</b>
        </div>

        <form action={startAction} className="mt-3">
          <button className="btn" type="submit">
            Starta ny säsong
          </button>
        </form>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Skapar nya omgångar (enkelmöten) från nästa vecka. Historik behålls.</p>
      </div>
    </div>
  )
}
