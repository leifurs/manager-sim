import { prisma } from "@/lib/prisma"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Matcher | ManagerSim",
  description: "Kommande och spelade matcher."
}

export default async function FixturesPage() {
  const fixtures = await prisma.fixture.findMany({
    include: { homeClub: true, awayClub: true, match: true },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }],
    take: 100
  })

  return (
    <div className="space-y-6">
      <h1>Matcher</h1>
      <div className="card">
        <table className="table">
          <thead className="thead">
            <tr className="tr">
              <th className="py-2 pr-2">Omg</th>
              <th className="py-2 pr-2">Hemmalag</th>
              <th className="py-2 pr-2">Bortalag</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Resultat</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map(f => (
              <tr key={f.id} className="tr">
                <td className="py-1 pr-2">{f.round}</td>
                <td className="py-1 pr-2">{f.homeClub.name}</td>
                <td className="py-1 pr-2">{f.awayClub.name}</td>
                <td className="py-1 pr-2">{f.status}</td>
                <td className="py-1 pr-2">{f.match ? `${(f.match as any).resultJson.home}–${(f.match as any).resultJson.away}` : "–"}</td>
                <td className="py-1 pr-2">
                  <Link href={`/fixtures/${f.id}`} className="btn">
                    Öppna
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
