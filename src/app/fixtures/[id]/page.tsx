import { prisma } from "@/lib/prisma"
import { simulateFixture } from "@/app/actions/sim"
import Link from "next/link"
import type { Metadata } from "next"

// Next 15: params är asynk – vänta in dem
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const fx = await prisma.fixture.findUnique({
    where: { id },
    include: { homeClub: true, awayClub: true }
  })
  const title = fx ? `${fx.homeClub.name} – ${fx.awayClub.name} | ManagerSim` : "Match | ManagerSim"
  return { title, description: "Matchdetaljer, resultat, xG och händelser." }
}

function StatusBadge({ status }: { status: string }) {
  const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold border"
  if (status === "PLAYED") {
    return <span className={`${base} border-emerald-600 text-emerald-700 dark:text-emerald-400`}>PLAYED</span>
  }
  return <span className={`${base} border-zinc-400 text-zinc-600 dark:text-zinc-300`}>SCHEDULED</span>
}

function Scoreboard({ home, away, res }: { home: string; away: string; res: { home: number; away: number } | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div className="text-right text-lg font-semibold">{home}</div>
      <div className="text-3xl font-bold tabular-nums">{res ? `${res.home}–${res.away}` : "–"}</div>
      <div className="text-lg font-semibold">{away}</div>
    </div>
  )
}

function EventList({ events }: { events: Array<{ minute: number; type: string; team: "HOME" | "AWAY"; playerName?: string }> }) {
  if (!events?.length) return <p className="text-sm text-zinc-500">Inga händelser.</p>
  const Tag = ({ t }: { t: "HOME" | "AWAY" }) => <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${t === "HOME" ? "bg-blue-600 text-white" : "bg-rose-600 text-white"}`}>{t === "HOME" ? "HEMMA" : "BORTA"}</span>
  return (
    <ul className="space-y-1">
      {events
        .slice()
        .sort((a, b) => a.minute - b.minute)
        .map((e, i) => (
          <li key={`${e.team}-${e.minute}-${i}`} className="text-sm">
            <span className="tabular-nums">{e.minute}'</span> – {e.type}
            {e.playerName ? (
              <>
                {" "}
                – <b>{e.playerName}</b>
              </>
            ) : null}{" "}
            <Tag t={e.team} />
          </li>
        ))}
    </ul>
  )
}

export default async function FixtureDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const fx = await prisma.fixture.findUnique({
    where: { id },
    include: {
      league: true,
      homeClub: true,
      awayClub: true,
      match: true
    }
  })

  if (!fx) {
    return (
      <div>
        <p>Matchen hittades inte.</p>
        <Link href="/fixtures" className="underline">
          Till matcher
        </Link>
      </div>
    )
  }

  const result = fx.match ? ((fx.match as any).resultJson as { home: number; away: number }) : null
  const xgHome = fx.match ? (fx.match as any).xgHome : null
  const xgAway = fx.match ? (fx.match as any).xgAway : null
  const events = fx.match ? ((fx.match as any).eventsJson as Array<{ minute: number; type: string; team: "HOME" | "AWAY" }>) : []

  // Server Action för att spela match (bara om ej spelad)
  async function playAction() {
    "use server"
    await simulateFixture(id)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/fixtures" className="text-sm underline">
          ← Till matcher
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {fx.homeClub.name} – {fx.awayClub.name}
        </h1>
        <StatusBadge status={fx.status} />
      </div>

      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        Liga: {fx.league?.name ?? "–"} · Omgång {fx.round} · {new Date(fx.kickoffAt).toLocaleDateString()}
      </div>

      <div className="card space-y-3">
        <Scoreboard home={fx.homeClub.name} away={fx.awayClub.name} res={result} />
        {fx.match && (
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            xG: <span className="tabular-nums">{xgHome?.toFixed(2)}</span> – <span className="tabular-nums">{xgAway?.toFixed(2)}</span>
          </div>
        )}
        {!fx.match && (
          <form action={playAction}>
            <button className="btn btn-primary">Spela match</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Händelser</h2>
        <div className="mt-2">
          <EventList events={events} />
        </div>
      </div>
    </div>
  )
}
