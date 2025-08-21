import { prisma } from "@/lib/prisma"
import Link from "next/link"
import type { Metadata } from "next"
import TacticForm from "./TacticForm"

// Next 15: params är asynk – vänta in dem innan användning
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const club = await prisma.club.findUnique({ where: { id } })
  return {
    title: club ? `${club.name} | ManagerSim` : "Klubb | ManagerSim",
    description: club ? `Information och trupp för ${club.name}.` : "Klubbinformation."
  }
}

function posLabel(pos: string) {
  switch (pos) {
    case "GK":
      return "Målvakt"
    case "DF":
      return "Försvar"
    case "MF":
      return "Mittfält"
    case "FW":
      return "Anfall"
    default:
      return pos
  }
}

export default async function ClubDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const club = await prisma.club.findUnique({
    where: { id },
    include: { league: true, players: true, tactic: true }
  })

  if (!club) {
    return (
      <div>
        <p>Klubben hittades inte.</p>
        <Link href="/clubs" className="underline">
          Tillbaka
        </Link>
      </div>
    )
  }

  const players = [...club.players].sort((a, b) => b.ovr - a.ovr)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clubs" className="text-sm underline">
          ← Till klubbar
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{club.name}</h1>
      <div className="text-sm text-gray-600 dark:text-zinc-300">
        Liga: {club.league?.name ?? "–"} · Budget: {club.budget} · Rykte: {club.reputation}
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Nuvarande taktik</h2>
        <div
          className="rounded-lg border bg-white p-4 shadow-sm
                        dark:bg-zinc-900 dark:border-zinc-800"
        >
          <pre className="text-sm overflow-x-auto text-zinc-800 dark:text-zinc-200">{JSON.stringify(club.tactic, null, 2)}</pre>
        </div>
        <div
          className="rounded-lg border bg-white p-4 shadow-sm
                        dark:bg-zinc-900 dark:border-zinc-800"
        >
          <TacticForm
            clubId={club.id}
            initial={{
              formation: club.tactic?.formation ?? null,
              styleJson: club.tactic?.styleJson ?? undefined // kan vara JsonValue|null
            }}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Trupp ({players.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-zinc-900">
              <tr className="text-left border-b dark:border-zinc-800">
                <th className="py-2 pr-2">ID</th>
                <th className="py-2 pr-2">Pos</th>
                <th className="py-2 pr-2">OVR</th>
                <th className="py-2 pr-2">PACE</th>
                <th className="py-2 pr-2">PASS</th>
                <th className="py-2 pr-2">SHOOT</th>
                <th className="py-2 pr-2">DEF</th>
                <th className="py-2 pr-2">GK</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.id} className={`border-b dark:border-zinc-800 ${i % 2 ? "bg-gray-50 dark:bg-zinc-950/40" : ""}`}>
                  <td className="py-1 pr-2 text-gray-800 dark:text-zinc-200">{p.id.slice(0, 8)}…</td>
                  <td className="py-1 pr-2">{posLabel(p.pos)}</td>
                  <td className="py-1 pr-2 font-medium">{p.ovr}</td>
                  <td className="py-1 pr-2">{p.pace}</td>
                  <td className="py-1 pr-2">{p.pass}</td>
                  <td className="py-1 pr-2">{p.shoot}</td>
                  <td className="py-1 pr-2">{p.defend}</td>
                  <td className="py-1 pr-2">{p.gk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
