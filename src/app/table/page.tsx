import type { Metadata } from "next"
import Link from "next/link"
import { getDefaultLeagueId, getLeagueTable } from "@/lib/standings"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Tabell | ManagerSim",
  description: "Ligatabell beräknad från spelade matcher."
}

function FormTag({ c }: { c: "V" | "O" | "F" }) {
  const base = "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold"
  if (c === "V") return <span className={`${base} bg-emerald-600 text-white`}>V</span>
  if (c === "O") return <span className={`${base} bg-zinc-400 text-white dark:bg-zinc-600`}>O</span>
  return <span className={`${base} bg-rose-600 text-white`}>F</span>
}

export default async function TablePage() {
  const leagueId = await getDefaultLeagueId()
  if (!leagueId) return <div>Ingen liga hittades.</div>

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  const table = await getLeagueTable(leagueId)

  return (
    <div className="space-y-6">
      <h1>Tabell – {league?.name}</h1>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead className="thead">
            <tr className="tr">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Klubb</th>
              <th className="py-2 pr-3 text-right">M</th>
              <th className="py-2 pr-3 text-right">V</th>
              <th className="py-2 pr-3 text-right">O</th>
              <th className="py-2 pr-3 text-right">F</th>
              <th className="py-2 pr-3 text-right">GM</th>
              <th className="py-2 pr-3 text-right">IM</th>
              <th className="py-2 pr-3 text-right">+/-</th>
              <th className="py-2 pr-3 text-right">P</th>
              <th className="py-2 pr-3 text-right">PPG</th>
              <th className="py-2 pr-3 text-right">Form</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.clubId} className="tr">
                <td className="py-1 pr-3">{i + 1}</td>
                <td className="py-1 pr-3">
                  <Link href={`/clubs/${r.clubId}`} className="underline">
                    {r.clubName}
                  </Link>
                </td>
                <td className="py-1 pr-3 text-right">{r.played}</td>
                <td className="py-1 pr-3 text-right">{r.won}</td>
                <td className="py-1 pr-3 text-right">{r.drawn}</td>
                <td className="py-1 pr-3 text-right">{r.lost}</td>
                <td className="py-1 pr-3 text-right">{r.gf}</td>
                <td className="py-1 pr-3 text-right">{r.ga}</td>
                <td className="py-1 pr-3 text-right">{r.gd}</td>
                <td className="py-1 pr-3 text-right font-semibold">{r.pts}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{r.ppg.toFixed(2)}</td>
                <td className="py-1 pr-3 text-right">
                  <div className="inline-flex gap-1">
                    {(r.form || "")
                      .split(" ")
                      .filter(Boolean)
                      .map((c, idx) => (
                        <FormTag key={`${r.clubId}-${idx}`} c={c as "V" | "O" | "F"} />
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Link href="/fixtures" className="btn">
          Till matcher
        </Link>
        <Link href="/fixtures/rounds" className="btn">
          Omgångar
        </Link>
      </div>
    </div>
  )
}
