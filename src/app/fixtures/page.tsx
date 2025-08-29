// src/app/fixtures/page.tsx
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { hasSuspendedForFixture } from "@/lib/disciplineUtil"
import { hasInjuredForFixture } from "@/lib/injuryUtil"
import { getCurrentSeasonNumber } from "@/lib/season"
import { simulateFixture, simulateRemainingSeason } from "@/app/actions/sim"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import SubmitButton from "@/components/SubmitButton"
import Toast from "@/components/Toast"
import InjuryBadge from "@/components/InjuryBadge"

export default async function FixturesPage() {
  const league = (await prisma.league.findFirst({ where: { tier: 1 } })) ?? (await prisma.league.findFirst())

  if (!league) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Matcher</h1>
        <div className="card">Ingen liga hittades.</div>
      </div>
    )
  }
  const leagueId = league.id

  const curSeason = await getCurrentSeasonNumber(leagueId)

  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, season: curSeason },
    include: { homeClub: true, awayClub: true, match: true },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }],
    take: 200
  })

  const flags = await Promise.all(
    fixtures.map(async fx => {
      const [s, i] = await Promise.all([hasSuspendedForFixture(fx.id), hasInjuredForFixture(fx.id)])
      return { id: fx.id, s, i }
    })
  )
  const flagMap = new Map(flags.map(f => [f.id, f]))

  async function playOne(formData: FormData) {
    "use server"
    const fid = String(formData.get("fixtureId") ?? "")
    if (!fid) return
    await simulateFixture(fid)
    revalidatePath("/fixtures")
    revalidatePath(`/fixtures/${fid}`)
    revalidatePath("/table")
    redirect("/fixtures?done=match")
  }

  async function playRestAction() {
    "use server"
    const res = await simulateRemainingSeason(leagueId)
    revalidatePath("/fixtures")
    revalidatePath("/fixtures/rounds")
    revalidatePath("/table")
    redirect(`/fixtures?done=season:${res.count ?? 0}`)
  }

  const remaining = fixtures.filter(f => f.status === "SCHEDULED").length

  return (
    <div className="space-y-4">
      <Toast />

      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            Matcher – {league.name} (Säsong {curSeason})
          </h1>
          <InjuryBadge />
        </div>
        <form action={playRestAction}>
          <SubmitButton pendingText="Spelar…">Spela resten av säsongen{remaining > 0 ? ` (${remaining})` : ""}</SubmitButton>
        </form>
      </div>

      <ul className="space-y-2">
        {fixtures.map(fx => {
          const f = flagMap.get(fx.id)
          const res = (fx as any).match?.resultJson as { home: number; away: number } | undefined
          const scheduled = fx.status === "SCHEDULED"

          return (
            <li key={fx.id} className="flex items-center justify-between border-b dark:border-zinc-800 py-1 gap-3">
              <div className="flex-1 min-w-0">
                <Link href={`/fixtures/${fx.id}`} className="underline truncate">
                  Omg {fx.round}: {fx.homeClub.name} – {fx.awayClub.name}
                </Link>
                {res ? (
                  <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-300 tabular-nums">
                    {res.home}–{res.away}
                  </span>
                ) : null}
              </div>

              <div className="ml-2 flex items-center gap-2">
                {f?.s ? (
                  <span title="Avstängningar" className="text-rose-600">
                    🚫
                  </span>
                ) : null}
                {f?.i ? (
                  <span title="Skador" className="text-sky-600">
                    🏥
                  </span>
                ) : null}
              </div>

              {scheduled ? (
                <form action={playOne}>
                  <input type="hidden" name="fixtureId" value={fx.id} />
                  <SubmitButton pendingText="Spelar…">Spela</SubmitButton>
                </form>
              ) : (
                <span className="text-xs text-zinc-500">Spelad</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
