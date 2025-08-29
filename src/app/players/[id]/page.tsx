import { prisma } from "@/lib/prisma"
import { getPlayerStats } from "@/lib/playerStats"
import Link from "next/link"
import type { Metadata } from "next"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const p = await prisma.player.findUnique({ where: { id }, include: { club: true } })
  const title = p ? `${p.name} (${p.pos}) | ${p.club?.name ?? "Klubblös"} | ManagerSim` : "Spelare | ManagerSim"
  return { title, description: "Spelarkort med attribut, statistik och matchbetyg." }
}

function LabelValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function Chip({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "emerald" | "blue" | "amber" | "rose" }) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    emerald: "bg-emerald-600 text-white",
    blue: "bg-blue-600 text-white",
    amber: "bg-amber-500 text-black",
    rose: "bg-rose-600 text-white"
  }
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
}

function Bar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-xs tabular-nums text-zinc-500">{hint ?? v}</span>
      </div>
      <div className="h-2 rounded bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const player = await prisma.player.findUnique({
    where: { id },
    include: { club: true }
  })
  if (!player) return <div>Spelaren hittades inte.</div>

  const stats = await getPlayerStats(id)

  const posLabel: Record<string, string> = { GK: "Målvakt", DF: "Försvar", MF: "Mittfält", FW: "Anfall" }
  const posText = posLabel[player.pos] ?? player.pos

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={player.clubId ? `/clubs/${player.clubId}` : "/clubs"} className="text-sm underline">
          ← {player.club?.name ?? "Till klubbar"}
        </Link>
        <Link href="/stats/scorers" className="btn">
          Statistik
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {posText} · Ålder {player.age} · OVR {player.ovr} (Pot {player.pot})
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone="blue">{player.club?.name ?? "Klubblös"}</Chip>
              {player.pos === "GK" ? <Chip tone="zinc">Målvakt</Chip> : null}
              <Chip tone="zinc">Kontrakt t.o.m. {player.contractUntil}</Chip>
              <Chip tone="emerald">Lön {player.wages}k/vecka</Chip>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <LabelValue label="Matcher" value={stats.appearances} />
              <LabelValue label="Mål" value={stats.goals} />
              <LabelValue label="Assist" value={stats.assists} />
              <LabelValue label="Gula" value={stats.yellows} />
              <LabelValue label="Röda" value={stats.reds} />
              <LabelValue label="Nollor" value={stats.cleanSheets} />
            </div>
          )}
        </div>
      </div>

      {/* Betyg */}
      <div className="card">
        <h2>Betyg per match</h2>
        {stats?.ratings?.length ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-4">
              <LabelValue label="Snitt" value={stats.avgRating?.toFixed(2) ?? "-"} />
              <LabelValue label="Senaste 5" value={stats.last5Avg?.toFixed(2) ?? "-"} />
              <div className="flex gap-1 items-center">
                {stats.ratings.slice(-5).map((r, i) => (
                  <span key={`${r.round}-${i}`} className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded bg-zinc-200 dark:bg-zinc-800 text-sm font-semibold tabular-nums" title={r.notes.join("\n")}>
                    {r.rating.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-zinc-900">
                  <tr className="text-left border-b dark:border-zinc-800">
                    <th className="py-2 pr-2">Omgång</th>
                    <th className="py-2 pr-2">Motstånd</th>
                    <th className="py-2 pr-2">Betyg</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.ratings.map(r => (
                    <tr key={`${r.round}-${r.vs}`} className="border-b dark:border-zinc-800">
                      <td className="py-1 pr-2">{r.round}</td>
                      <td className="py-1 pr-2">{r.vs}</td>
                      <td className="py-1 pr-2 font-semibold tabular-nums">
                        <span className="inline-flex rounded px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800" title={r.notes.join("\n")}>
                          {r.rating.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Inga betyg ännu.</p>
        )}
      </div>

      {/* Attribut */}
      <div className="card">
        <h2>Attribut</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Bar label="Pace" value={player.pace} />
          <Bar label="Passing" value={player.pass} />
          <Bar label="Skott" value={player.shoot} />
          <Bar label="Försvar" value={player.defend} />
          <Bar label="Stamina" value={player.stamina} />
          <Bar label="Målvakt" value={player.gk} />
        </div>
      </div>

      {/* Händelser */}
      {stats?.lastEvents?.length ? (
        <div className="card">
          <h2>Senaste händelser</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {stats.lastEvents.map((e, i) => {
              const tone = e.type === "Mål" ? "emerald" : e.type === "Assist" ? "blue" : e.type.includes("Rött") ? "rose" : "amber"
              return (
                <li key={`${e.round}-${e.minute}-${i}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${tone === "emerald" ? "bg-emerald-600 text-white" : tone === "blue" ? "bg-blue-600 text-white" : tone === "rose" ? "bg-rose-600 text-white" : "bg-amber-500 text-black"}`}>{e.type}</span>
                    <span className="tabular-nums">{e.minute}'</span>
                  </div>
                  <span className="text-zinc-500">
                    Omg. {e.round} · vs {e.vs} ({e.team === "HOME" ? "H" : "B"})
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="card">
          <h2>Senaste händelser</h2>
          <p className="mt-2 text-sm text-zinc-500">Inga händelser registrerade ännu.</p>
        </div>
      )}

      <div className="flex gap-2">
        <Link href="/fixtures" className="btn">
          Matcher
        </Link>
        <Link href="/table" className="btn">
          Tabell
        </Link>
        <Link href="/stats/scorers" className="btn">
          Skytteliga
        </Link>
      </div>
    </div>
  )
}
