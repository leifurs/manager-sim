// src/app/table/page.tsx
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { getSuspendedForNextFixtureOfClub } from "@/lib/disciplineUtil"
import { getInjuredForNextFixtureOfClub } from "@/lib/injuryUtil"
import { getCurrentSeasonNumber } from "@/lib/season"

type Row = {
  clubId: string
  name: string
  mp: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
  ppg: number
}

export default async function LeagueTablePage() {
  const league = (await prisma.league.findFirst({ where: { tier: 1 } })) ?? (await prisma.league.findFirst())
  if (!league) return <div>Ingen liga hittades.</div>

  const curSeason = await getCurrentSeasonNumber(league.id)

  const clubs = await prisma.club.findMany({
    where: { leagueId: league.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  })

  const fixtures = await prisma.fixture.findMany({
    where: { leagueId: league.id, season: curSeason, status: "PLAYED" },
    include: { match: true }
  })

  const table = new Map<string, Row>()
  for (const c of clubs) {
    table.set(c.id, {
      clubId: c.id,
      name: c.name,
      mp: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
      ppg: 0
    })
  }

  for (const f of fixtures) {
    const res = (f.match as any)?.resultJson as { home: number; away: number } | undefined
    if (!res) continue
    const home = table.get(f.homeClubId)
    const away = table.get(f.awayClubId)
    if (!home || !away) continue

    home.mp++
    away.mp++
    home.gf += res.home
    home.ga += res.away
    home.gd = home.gf - home.ga
    away.gf += res.away
    away.ga += res.home
    away.gd = away.gf - away.ga

    if (res.home > res.away) {
      home.w++
      home.pts += 3
      away.l++
    } else if (res.home < res.away) {
      away.w++
      away.pts += 3
      home.l++
    } else {
      home.d++
      away.d++
      home.pts++
      away.pts++
    }
  }

  const rows = [...table.values()].map(r => ({ ...r, ppg: r.mp ? Math.round((r.pts / r.mp) * 100) / 100 : 0 }))
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))

  // Susp + Inj (ids -> namn för popovers)
  const [suspSets, injSets] = await Promise.all([Promise.all(rows.map(r => getSuspendedForNextFixtureOfClub(r.clubId))), Promise.all(rows.map(r => getInjuredForNextFixtureOfClub(r.clubId)))])

  const suspData = await Promise.all(
    rows.map(async (r, i) => {
      const ids = suspSets[i]
      if (!ids || ids.size === 0) return []
      return prisma.player.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true, name: true } })
    })
  )
  const injData = await Promise.all(
    rows.map(async (r, i) => {
      const ids = injSets[i]
      if (!ids || ids.size === 0) return []
      return prisma.player.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true, name: true } })
    })
  )

  const teamsWithSusp = suspData.filter(list => list.length > 0).length
  const teamsWithInj = injData.filter(list => list.length > 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">
          {league.name} – Tabell (Säsong {curSeason})
        </h1>
        <div className="text-sm text-zinc-600 dark:text-zinc-300">🚫 avstängd · 🏥 skadad</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-3 text-sm shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <span className="font-medium">{teamsWithSusp}</span> lag har avstängda inför nästa omgång.
        </div>
        <div className="rounded-lg border bg-white p-3 text-sm shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <span className="font-medium">{teamsWithInj}</span> lag har skador inför nästa omgång.
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-zinc-900">
            <tr className="text-left border-b dark:border-zinc-800">
              <th className="py-2 px-2">#</th>
              <th className="py-2 px-2">Klubb</th>
              <th className="py-2 px-2">MP</th>
              <th className="py-2 px-2">W</th>
              <th className="py-2 px-2">D</th>
              <th className="py-2 px-2">L</th>
              <th className="py-2 px-2">GF</th>
              <th className="py-2 px-2">GA</th>
              <th className="py-2 px-2">GD</th>
              <th className="py-2 px-2">Pts</th>
              <th className="py-2 px-2">PPG</th>
              <th className="py-2 px-2">Susp</th>
              <th className="py-2 px-2">Inj</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const suspPlayers = suspData[idx]
              const injPlayers = injData[idx]
              return (
                <tr key={r.clubId} className={`border-b dark:border-zinc-800 ${idx % 2 ? "bg-gray-50 dark:bg-zinc-950/40" : ""}`}>
                  <td className="py-1 px-2 tabular-nums">{idx + 1}</td>
                  <td className="py-1 px-2">
                    <Link href={`/clubs/${r.clubId}`} className="underline inline-flex items-center gap-1">
                      {r.name}
                      {suspPlayers.length > 0 ? <span className="text-rose-600">🚫</span> : null}
                      {injPlayers.length > 0 ? <span className="text-sky-600">🏥</span> : null}
                    </Link>
                  </td>
                  <td className="py-1 px-2 tabular-nums">{r.mp}</td>
                  <td className="py-1 px-2 tabular-nums">{r.w}</td>
                  <td className="py-1 px-2 tabular-nums">{r.d}</td>
                  <td className="py-1 px-2 tabular-nums">{r.l}</td>
                  <td className="py-1 px-2 tabular-nums">{r.gf}</td>
                  <td className="py-1 px-2 tabular-nums">{r.ga}</td>
                  <td className="py-1 px-2 tabular-nums">{r.gd}</td>
                  <td className="py-1 px-2 tabular-nums font-semibold">{r.pts}</td>
                  <td className="py-1 px-2 tabular-nums">{r.ppg.toFixed(2)}</td>
                  {/* Susp popover */}
                  <td className="py-1 px-2 tabular-nums relative group">
                    {suspPlayers.length > 0 ? (
                      <div className="inline-flex items-center gap-1 cursor-pointer">
                        {suspPlayers.length} <span className="text-rose-600">🚫</span>
                        <div className="absolute left-0 top-full z-10 hidden group-hover:block bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded shadow-md p-2 mt-1 text-xs w-40">
                          <ul className="space-y-1">
                            {suspPlayers.map(p => (
                              <li key={p.id}>
                                <Link href={`/players/${p.id}`} className="underline">
                                  {p.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      "0"
                    )}
                  </td>
                  {/* Inj popover */}
                  <td className="py-1 px-2 tabular-nums relative group">
                    {injPlayers.length > 0 ? (
                      <div className="inline-flex items-center gap-1 cursor-pointer">
                        {injPlayers.length} <span className="text-sky-600">🏥</span>
                        <div className="absolute left-0 top-full z-10 hidden group-hover:block bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded shadow-md p-2 mt-1 text-xs w-40">
                          <ul className="space-y-1">
                            {injPlayers.map(p => (
                              <li key={p.id}>
                                <Link href={`/players/${p.id}`} className="underline">
                                  {p.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      "0"
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Link href="/fixtures" className="btn">
          Matcher
        </Link>
        <Link href="/fixtures/rounds" className="btn">
          Omgångar
        </Link>
        <Link href="/stats/scorers" className="btn">
          Skytteliga
        </Link>
      </div>
    </div>
  )
}
