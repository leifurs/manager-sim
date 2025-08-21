import { prisma } from "@/lib/prisma"
import { simulateRound } from "@/app/actions/simRound"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Omgångar | ManagerSim",
  description: "Spela hela omgångar i ligan."
}

export default async function RoundsPage() {
  // Ta första ligan (samma antagande som i tabellen)
  const league = await prisma.league.findFirst({
    orderBy: { tier: "asc" }
  })
  if (!league) return <div>Ingen liga hittades.</div>

  // Sammanställ antal spelade/ospelade per omgång
  const rounds = await prisma.fixture.groupBy({
    by: ["round"],
    where: { leagueId: league.id },
    _count: { _all: true }
  })

  // Hur många spelade per omgång?
  const playedCounts = await prisma.fixture.groupBy({
    by: ["round"],
    where: { leagueId: league.id, status: "PLAYED" },
    _count: { _all: true }
  })
  const playedMap = new Map(playedCounts.map(r => [r.round, r._count._all]))

  async function playAction(formData: FormData) {
    "use server"
    const round = Number(formData.get("round"))
    if (!league) {
      throw new Error("Ingen liga hittades.")
    }
    await simulateRound(league.id, round)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Omgångar – {league.name}</h1>
        <Link href="/fixtures" className="btn">
          Till matcher
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead className="thead">
            <tr className="tr">
              <th className="py-2 pr-3">Omgång</th>
              <th className="py-2 pr-3 text-right">Matcher (spelade/total)</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {rounds
              .sort((a, b) => a.round - b.round)
              .map(r => {
                const total = r._count._all
                const played = playedMap.get(r.round) ?? 0
                const remaining = total - played
                return (
                  <tr key={r.round} className="tr">
                    <td className="py-1 pr-3">{r.round}</td>
                    <td className="py-1 pr-3 text-right">
                      {played} / {total}
                    </td>
                    <td className="py-1 pr-3 text-right">
                      <form action={playAction} className="inline-flex">
                        <input type="hidden" name="round" value={r.round} />
                        <button className="btn btn-primary" disabled={remaining === 0} title={remaining === 0 ? "Omgången är redan spelad" : "Spela alla ospelade matcher i omgången"}>
                          Spela omgång
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
