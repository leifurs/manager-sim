import type { Metadata } from "next"
import Link from "next/link"
import { getDefaultLeagueId } from "@/lib/standings"
import { getTopKeepers } from "@/lib/keepers"

export const metadata: Metadata = { title: "Målvakter | ManagerSim" }

export default async function KeepersPage() {
  const leagueId = await getDefaultLeagueId()
  if (!leagueId) return <div>Ingen liga.</div>
  const rows = await getTopKeepers(leagueId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Målvakter – hållna nollor</h1>
        <div className="flex gap-2">
          <Link className="btn" href="/stats/scorers">
            Skytteliga
          </Link>
          <Link className="btn" href="/stats/assists">
            Assistliga
          </Link>
          <Link className="btn" href="/stats/discipline">
            Disciplin
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead className="thead">
            <tr className="tr">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Målvakt</th>
              <th className="py-2 pr-3">Klubb</th>
              <th className="py-2 pr-3 text-right">Nollor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.playerId} className="tr">
                <td className="py-1 pr-3">{i + 1}</td>
                <td className="py-1 pr-3">{r.playerName}</td>
                <td className="py-1 pr-3">{r.clubName}</td>
                <td className="py-1 pr-3 text-right font-semibold">{r.cleanSheets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
