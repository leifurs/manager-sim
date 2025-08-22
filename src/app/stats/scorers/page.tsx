import type { Metadata } from "next"
import Link from "next/link"
import { getTopScorers } from "@/lib/scorers"
import { getDefaultLeagueId } from "@/lib/standings"

export const metadata: Metadata = {
  title: "Skytteliga | ManagerSim",
  description: "Toppskytt-lista baserad på spelade matcher."
}

export default async function ScorersPage() {
  const leagueId = await getDefaultLeagueId()
  if (!leagueId) return <div>Ingen liga hittades.</div>

  const rows = await getTopScorers(leagueId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Skytteliga</h1>
        <div className="flex gap-2">
          <Link href="/table" className="btn">
            Tabell
          </Link>
          <Link href="/fixtures" className="btn">
            Matcher
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead className="thead">
            <tr className="tr">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Spelare</th>
              <th className="py-2 pr-3">Klubb</th>
              <th className="py-2 pr-3 text-right">Mål</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.playerId} className="tr">
                <td className="py-1 pr-3">{i + 1}</td>
                <td className="py-1 pr-3">{r.playerName}</td>
                <td className="py-1 pr-3">{r.clubName}</td>
                <td className="py-1 pr-3 text-right font-semibold">{r.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
