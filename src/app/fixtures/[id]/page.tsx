// src/app/fixtures/[id]/page.tsx
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import type { Metadata } from "next"
import { simulateFixture } from "@/app/actions/sim"
import { getSuspendedForFixture } from "@/lib/disciplineUtil"
import { getInjuredForFixture } from "@/lib/injuryUtil"

// Next 15: params är asynk – vänta in dem
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const fx = await prisma.fixture.findUnique({
    where: { id },
    include: { homeClub: true, awayClub: true, league: true, match: true }
  })
  if (!fx) return { title: "Match | ManagerSim" }
  const title = `${fx.homeClub.name} – ${fx.awayClub.name}${fx.match ? ` ${(fx.match as any).resultJson?.home ?? 0}–${(fx.match as any).resultJson?.away ?? 0}` : ""} | Omg. ${fx.round}`
  return { title, description: `Matchdetaljer för omgång ${fx.round} i ${fx.league?.name ?? "ligan"}.` }
}

type AnyEvent = {
  minute: number
  type: "GOAL" | "CARD_YELLOW" | "CARD_RED" | "LINEUP" | "INJURY"
  team: "HOME" | "AWAY"
  playerId?: string
  playerName?: string
  assistPlayerId?: string
  assistPlayerName?: string
  playerIds?: string[]
  gamesOut?: number
}

function fmtKickoff(d: Date) {
  return new Date(d).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })
}

export default async function FixturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const fixture = await prisma.fixture.findUnique({
    where: { id },
    include: {
      league: true,
      homeClub: { include: { tactic: true } },
      awayClub: { include: { tactic: true } },
      match: true
    }
  })

  if (!fixture) {
    return (
      <div>
        <p>Matchen hittades inte.</p>
        <Link href="/fixtures" className="underline">
          Tillbaka
        </Link>
      </div>
    )
  }

  const played = Boolean(fixture.match)
  const res = (fixture.match as any)?.resultJson as { home: number; away: number; potm?: { playerId: string; name: string; rating: number } | null } | undefined

  const xgHome = fixture.match?.xgHome ?? null
  const xgAway = fixture.match?.xgAway ?? null

  const events = ((fixture.match as any)?.eventsJson as AnyEvent[] | undefined)?.slice().sort((a, b) => a.minute - b.minute) ?? []

  // Avstängda & skadade (namnlistor)
  const [suspendedSets, injuredSets] = await Promise.all([getSuspendedForFixture(id), getInjuredForFixture(id)])
  const [suspHomePlayers, suspAwayPlayers, injHomePlayers, injAwayPlayers] = await Promise.all([suspendedSets.home.size ? prisma.player.findMany({ where: { id: { in: [...suspendedSets.home] } }, select: { id: true, name: true } }) : Promise.resolve([]), suspendedSets.away.size ? prisma.player.findMany({ where: { id: { in: [...suspendedSets.away] } }, select: { id: true, name: true } }) : Promise.resolve([]), injuredSets.home.size ? prisma.player.findMany({ where: { id: { in: [...injuredSets.home] } }, select: { id: true, name: true } }) : Promise.resolve([]), injuredSets.away.size ? prisma.player.findMany({ where: { id: { in: [...injuredSets.away] } }, select: { id: true, name: true } }) : Promise.resolve([])])

  // Server Action för att spela matchen
  async function playAction() {
    "use server"
    await simulateFixture(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/fixtures" className="text-sm underline">
          ← Till matcher
        </Link>
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          {fixture.league?.name ?? "Liga"} · Omgång {fixture.round} · {fmtKickoff(fixture.kickoffAt)}
        </div>
      </div>

      {/* Resultat */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">
              {fixture.homeClub.name} – {fixture.awayClub.name}
            </h1>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              {played ? (
                <span>
                  Resultat:{" "}
                  <strong className="tabular-nums">
                    {res?.home ?? 0}–{res?.away ?? 0}
                  </strong>
                </span>
              ) : (
                <span>Ej spelad</span>
              )}
              {typeof xgHome === "number" && typeof xgAway === "number" ? (
                <span className="ml-3">
                  xG:{" "}
                  <span className="tabular-nums">
                    {xgHome.toFixed(2)}–{xgAway.toFixed(2)}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {!played ? (
            <form action={playAction}>
              <button className="btn" type="submit">
                Spela match
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Saknas p.g.a. avstängning / skada */}
      {suspHomePlayers.length || suspAwayPlayers.length || injHomePlayers.length || injAwayPlayers.length ? (
        <div className="card">
          <h2>Saknas</h2>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-semibold mb-1">{fixture.homeClub.name}</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {suspHomePlayers.map(p => (
                  <li key={`s-${p.id}`} title="Avstängd">
                    🚫{" "}
                    <Link href={`/players/${p.id}`} className="underline">
                      {p.name}
                    </Link>
                  </li>
                ))}
                {injHomePlayers.map(p => (
                  <li key={`i-${p.id}`} title="Skadad">
                    🏥{" "}
                    <Link href={`/players/${p.id}`} className="underline">
                      {p.name}
                    </Link>
                  </li>
                ))}
                {!suspHomePlayers.length && !injHomePlayers.length ? <li className="text-zinc-500">— Inga</li> : null}
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-1">{fixture.awayClub.name}</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {suspAwayPlayers.map(p => (
                  <li key={`s-${p.id}`} title="Avstängd">
                    🚫{" "}
                    <Link href={`/players/${p.id}`} className="underline">
                      {p.name}
                    </Link>
                  </li>
                ))}
                {injAwayPlayers.map(p => (
                  <li key={`i-${p.id}`} title="Skadad">
                    🏥{" "}
                    <Link href={`/players/${p.id}`} className="underline">
                      {p.name}
                    </Link>
                  </li>
                ))}
                {!suspAwayPlayers.length && !injAwayPlayers.length ? <li className="text-zinc-500">— Inga</li> : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* Player of the Match */}
      {played && res?.potm ? (
        <div className="card">
          <h2>Player of the Match</h2>
          <div className="mt-2 flex items-center justify-between text-sm">
            <Link href={`/players/${res.potm.playerId}`} className="underline">
              {res.potm.name}
            </Link>
            <span className="font-semibold tabular-nums">{res.potm.rating.toFixed(2)}</span>
          </div>
        </div>
      ) : null}

      {/* Händelser */}
      <div className="card">
        <h2>Händelser</h2>
        {played && events.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {events
              .filter(e => e.type !== "LINEUP")
              .map((e, i) => {
                const badge = e.type === "GOAL" ? "bg-emerald-600 text-white" : e.type === "CARD_RED" ? "bg-rose-600 text-white" : e.type === "CARD_YELLOW" ? "bg-amber-500 text-black" : "bg-sky-600 text-white" // INJURY
                const label = e.type === "GOAL" ? "Mål" : e.type === "CARD_RED" ? "Rött kort" : e.type === "CARD_YELLOW" ? "Gult kort" : "Skada"
                const who = e.type === "GOAL" ? (e.assistPlayerName ? `${e.playerName} (assist: ${e.assistPlayerName})` : e.playerName) : e.playerName
                const side = e.team === "HOME" ? "H" : "B"

                return (
                  <li key={`${e.type}-${e.minute}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${badge}`}>{label}</span>
                      <span className="tabular-nums">{e.minute}'</span>
                      <span>({side})</span>
                      <span>{who}</span>
                      {e.type === "INJURY" && typeof e.gamesOut === "number" ? (
                        <span className="text-xs text-zinc-500">
                          ({e.gamesOut} match{e.gamesOut > 1 ? "er" : ""} borta)
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">{played ? "Inga händelser registrerade." : "Matchen är inte spelad ännu."}</p>
        )}
      </div>

      {/* Snabblänkar */}
      <div className="flex gap-2">
        <Link href={`/clubs/${fixture.homeClubId}`} className="btn">
          Hemmalag
        </Link>
        <Link href={`/clubs/${fixture.awayClubId}`} className="btn">
          Bortalag
        </Link>
        <Link href="/table" className="btn">
          Tabell
        </Link>
      </div>
    </div>
  )
}
