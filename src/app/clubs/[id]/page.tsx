// src/app/clubs/[id]/page.tsx
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import type { Metadata } from "next"
import TacticForm from "./TacticForm"
import PlayerTable from "./PlayerTable"
import { suggestLineup } from "./actions"
import Toast from "@/components/Toast"
import FormationBoard from "@/components/FormationBoard"
import { getCurrentInjuriesForClub } from "@/lib/injuries"
import type { ReactElement } from "react"
import { canEditLineupNow } from "@/lib/lineupLock"
import { auth } from "@/lib/auth"
import { takeOverClub } from "@/app/clubs/actions"

// Next 15: params är asynk – vänta in dem innan användning
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const club = await prisma.club.findUnique({ where: { id } })
  return {
    title: club ? `${club.name} | ManagerSim` : "Klubb | ManagerSim",
    description: club ? `Information och trupp för ${club.name}.` : "Klubbinformation."
  }
}

function parseLineup(style: any): Partial<Record<"GK" | "DF" | "MF" | "FW", string[]>> | null {
  const lu = style?.lineup
  if (!lu) return null
  return {
    GK: Array.isArray(lu.GK) ? lu.GK : [],
    DF: Array.isArray(lu.DF) ? lu.DF : [],
    MF: Array.isArray(lu.MF) ? lu.MF : [],
    FW: Array.isArray(lu.FW) ? lu.FW : []
  }
}

export default async function ClubDetail({ params }: { params: Promise<{ id: string }> }): Promise<ReactElement> {
  const { id } = await params
  const session = await auth()

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
  {
    session?.user && (
      <form action={takeOverClub.bind(null, club.id)}>
        <button type="submit" className="rounded-md border px-3 py-1.5 text-sm shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
          Ta över klubb
        </button>
      </form>
    )
  }
  // Hämta skador efter att vi vet klubbens id
  const injuries = await getCurrentInjuriesForClub(id)

  const players = club.players
    .map(p => ({
      id: p.id,
      name: (p as any).name ?? null,
      pos: p.pos as "GK" | "DF" | "MF" | "FW",
      subPos: (p as any).subPos ?? null,
      ovr: p.ovr,
      pace: p.pace,
      pass: p.pass,
      shoot: p.shoot,
      defend: p.defend,
      gk: p.gk,
      fatigue: (p as any).fatigue ?? 0,
      form: (p as any).form ?? 0
    }))
    .sort((a, b) => b.ovr - a.ovr)

  const lineup = parseLineup(club.tactic?.styleJson ?? null)
  const currentFormation = club.tactic?.formation ?? "4-3-3"
  const canEdit = await canEditLineupNow(club.id)

  return (
    <div className="space-y-6">
      <Toast />

      <div>
        <Link href="/clubs" className="text-sm underline">
          ← Till klubbar
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{club.name}</h1>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Liga: {club.league?.name ?? "–"} · Budget: {club.budget} · Rykte: {club.reputation}
          </div>
        </div>

        {/* Formation + Föreslå startelva */}
        <form action={suggestLineup.bind(null, club.id)} className="flex items-center gap-2">
          <select name="formation" defaultValue={currentFormation} className="rounded-md border px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <option value="4-3-3">4-3-3</option>
            <option value="4-2-3-1">4-2-3-1</option>
            <option value="4-4-2">4-4-2</option>
            <option value="3-5-2">3-5-2</option>
          </select>
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
            Föreslå startelva
          </button>
        </form>
      </div>

      {players.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Formation board (drag & drop)</h2>
            {!canEdit && <span className="text-xs rounded bg-amber-100 px-2 py-0.5 text-amber-800">Låst inför match</span>}
          </div>
          <div className={canEdit ? "" : "pointer-events-none opacity-60"}>
            <FormationBoard clubId={club.id} formation={currentFormation} players={players} initialGroups={lineup ?? undefined} />
          </div>
        </section>
      )}

      {/* Skador */}
      {injuries.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Skador</h2>
          <div className="rounded-lg border dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-zinc-900">
                <tr className="text-left border-b dark:border-zinc-800">
                  <th className="py-2 pl-3 pr-3">Spelare</th>
                  <th className="py-2 pr-3">Roll</th>
                  <th className="py-2 pr-3">Matcher kvar</th>
                </tr>
              </thead>
              <tbody>
                {injuries.map(p => (
                  <tr key={p.id} className="border-b dark:border-zinc-800">
                    <td className="py-1 pl-3 pr-3">{p.name}</td>
                    <td className="py-1 pr-3">{p.subPos ?? p.pos}</td>
                    <td className="py-1 pr-3 tabular-nums">{p.gamesRemaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section>
          <h2 className="font-semibold">Skador</h2>
          <p className="text-sm text-zinc-500">Inga aktuella skador.</p>
        </section>
      )}

      {/* Taktik */}
      <section className="space-y-3">
        <h2 className="font-semibold">Nuvarande taktik</h2>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <pre className="text-sm overflow-x-auto text-zinc-800 dark:text-zinc-200">{JSON.stringify(club.tactic, null, 2)}</pre>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <TacticForm
            clubId={club.id}
            initial={{
              formation: club.tactic?.formation ?? null,
              styleJson: club.tactic?.styleJson ?? undefined
            }}
          />
        </div>
      </section>

      {/* Startelva (lista) */}
      {lineup && (
        <section className="space-y-2">
          <h2 className="font-semibold">Startelva ({currentFormation})</h2>
          <div className="grid gap-2 sm:grid-cols-4">
            <LineupCol title="GK" ids={lineup.GK ?? []} players={players} />
            <LineupCol title="DF" ids={lineup.DF ?? []} players={players} />
            <LineupCol title="MF" ids={lineup.MF ?? []} players={players} />
            <LineupCol title="FW" ids={lineup.FW ?? []} players={players} />
          </div>
        </section>
      )}

      {/* Trupp */}
      <section className="space-y-2">
        <h2 className="font-semibold">Trupp ({players.length})</h2>
        <PlayerTable players={players} />
      </section>
    </div>
  )
}

function LineupCol({ title, ids, players }: { title: string; ids: string[]; players: { id: string; name: string | null; pos: string; ovr: number; fatigue?: number; form?: number }[] }) {
  const map = new Map(players.map(p => [p.id, p]))
  return (
    <div className="rounded-lg border p-3 dark:border-zinc-800">
      <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</div>
      <ul className="space-y-1">
        {ids.length === 0 && <li className="text-xs text-zinc-500">–</li>}
        {ids.map(id => {
          const p = map.get(id)
          if (!p) {
            return (
              <li key={id} className="text-xs text-zinc-500">
                {id.slice(0, 8)}…
              </li>
            )
          }
          const eff = Math.max(1, Math.round(p.ovr * (1 - Math.max(0, Math.min(100, p.fatigue ?? 0)) * 0.002) + (p.form ?? 0) * 2))
          return (
            <li key={id} className="flex items-center justify-between gap-2">
              <span className="truncate">{p.name ?? id.slice(0, 8)}</span>
              <span className="tabular-nums text-xs text-zinc-600 dark:text-zinc-300">{eff}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
