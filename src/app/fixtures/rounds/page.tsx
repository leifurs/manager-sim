// src/app/fixtures/rounds/page.tsx
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { hasSuspendedForFixture } from "@/lib/disciplineUtil"
import { hasInjuredForFixture } from "@/lib/injuryUtil"
import { getCurrentSeasonNumber } from "@/lib/season"
import { simulateFixture, simulateRound } from "@/app/actions/sim"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import SubmitButton from "@/components/SubmitButton"
import Toast from "@/components/Toast"

export default async function FixtureRoundsPage() {
  const league = (await prisma.league.findFirst({ where: { tier: 1 } })) ?? (await prisma.league.findFirst())
  if (!league) return <div>Ingen liga hittades.</div>
  const leagueId = league.id

  const curSeason = await getCurrentSeasonNumber(leagueId)

  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, season: curSeason },
    include: { homeClub: true, awayClub: true, match: true },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }]
  })

  const byRound = new Map<number, typeof fixtures>()
  for (const fx of fixtures) {
    if (!byRound.has(fx.round)) byRound.set(fx.round, [])
    byRound.get(fx.round)!.push(fx)
  }

  const rounds = [...byRound.keys()].sort((a, b) => a - b)
  let nextUnplayed: number | null = null
  for (const r of rounds) {
    const arr = byRound.get(r)!
    if (arr.some(f => f.status === "SCHEDULED")) {
      nextUnplayed = r
      break
    }
  }

  const allFlags = await Promise.all(
    fixtures.map(async fx => {
      const [s, i] = await Promise.all([hasSuspendedForFixture(fx.id), hasInjuredForFixture(fx.id)])
      return { id: fx.id, s, i }
    })
  )
  const flagMap = new Map(allFlags.map(f => [f.id, f]))

  async function playOne(formData: FormData) {
    "use server"
    const fid = String(formData.get("fixtureId") ?? "")
    if (!fid) return
    await simulateFixture(fid)
    revalidatePath("/fixtures/rounds")
    revalidatePath(`/fixtures/${fid}`)
    revalidatePath("/fixtures")
    revalidatePath("/table")
    redirect("/fixtures/rounds?done=match")
  }

  async function playRoundAction(formData: FormData) {
    "use server"
    const round = Number(formData.get("round"))
    if (!Number.isFinite(round)) return
    const res = await simulateRound(leagueId, round)
    revalidatePath("/fixtures/rounds")
    revalidatePath("/fixtures")
    revalidatePath("/table")
    redirect(`/fixtures/rounds?done=round:${round}:${res.count ?? 0}`)
  }

  return (
    <div className="space-y-4">
      <Toast />

      <h1 className="text-2xl font-bold">
        Omgångar – {league.name} (Säsong {curSeason})
      </h1>

      <div className="space-y-3">
        {rounds.map(round => {
          const list = byRound.get(round)!
          const anyScheduled = list.some(f => f.status === "SCHEDULED")
          const open = nextUnplayed ? round === nextUnplayed : rounds[0] === round

          return (
            <details key={round} className="card" {...(open ? { open: true } : {})}>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Omgång {round}</h2>
                  <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <span>{list.length} matcher</span>
                    {anyScheduled ? (
                      <form action={playRoundAction}>
                        <input type="hidden" name="round" value={round} />
                        <SubmitButton size="sm" pendingText="Spelar…">
                          Spela omgång
                        </SubmitButton>
                      </form>
                    ) : (
                      <span className="text-xs">Omgång spelad</span>
                    )}
                  </div>
                </div>
              </summary>

              <ul className="mt-3 space-y-1">
                {list.map(fx => {
                  const flags = flagMap.get(fx.id)
                  const res = (fx as any).match?.resultJson as { home: number; away: number } | undefined
                  const scheduled = fx.status === "SCHEDULED"

                  return (
                    <li key={fx.id} className="flex items-center justify-between border-b dark:border-zinc-800 py-1 gap-3">
                      <div className="flex-1 min-w-0">
                        <Link href={`/fixtures/${fx.id}`} className="underline truncate">
                          {fx.homeClub.name} – {fx.awayClub.name}
                        </Link>
                        {res ? (
                          <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-300 tabular-nums">
                            {res.home}–{res.away}
                          </span>
                        ) : null}
                      </div>

                      <div className="ml-2 flex items-center gap-2">
                        {flags?.s ? (
                          <span title="Avstängningar" className="text-rose-600">
                            🚫
                          </span>
                        ) : null}
                        {flags?.i ? (
                          <span title="Skador" className="text-sky-600">
                            🏥
                          </span>
                        ) : null}
                      </div>

                      {scheduled ? (
                        <form action={playOne}>
                          <input type="hidden" name="fixtureId" value={fx.id} />
                          <SubmitButton size="sm" pendingText="Spelar…">
                            Spela
                          </SubmitButton>
                        </form>
                      ) : (
                        <span className="text-xs text-zinc-500">Spelad</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </div>
    </div>
  )
}
