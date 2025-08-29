import { prisma } from "@/lib/prisma"
import { scheduleNext, simulateNextNow } from "./actions"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function GameLoopAdminPage() {
  const leagues = await prisma.league.findMany({
    select: {
      id: true,
      name: true,
      tier: true,
      country: true,
      currentSeason: true,
      nextRound: true,
      nextSimAt: true,
      _count: { select: { fixtures: true, clubs: true } },
      fixtures: {
        where: { status: "SCHEDULED" },
        select: { round: true },
        orderBy: { round: "asc" },
        take: 1
      }
    },
    orderBy: { tier: "asc" }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Game Loop – Admin</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">Hantera omgångar per liga: schemalägg nästa omgång eller simulera direkt.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {leagues.map(l => {
          const computedNext = l.fixtures[0]?.round ?? null
          return (
            <div key={l.id} className="rounded-lg border p-4 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {l.name} (Tier {l.tier}, {l.country})
                  </div>
                  <div className="text-xs text-zinc-500">
                    Klubbar: {l._count.clubs} · Fixtures: {l._count.fixtures}
                  </div>
                </div>
                <Link href="/fixtures/rounds" className="text-xs underline">
                  Visa omgångar
                </Link>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-zinc-500">Säsong</dt>
                  <dd>{l.currentSeason}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Nästa runda (lagrad)</dt>
                  <dd>{l.nextRound}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Nästa runda (beräknad)</dt>
                  <dd>{computedNext ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Planerad sim</dt>
                  <dd>{l.nextSimAt ? new Date(l.nextSimAt).toLocaleString() : "–"}</dd>
                </div>
              </dl>

              <form
                action={async () => {
                  "use server"
                  await simulateNextNow(l.id)
                }}
                className="mt-3 inline-block"
              >
                <button className="rounded border px-3 py-1.5 text-sm dark:border-zinc-700">Simulera nästa omgång nu</button>
              </form>

              <div className="mt-2 flex items-center gap-2">
                <form
                  action={async () => {
                    "use server"
                    await scheduleNext(l.id, 2)
                  }}
                >
                  <button className="rounded border px-3 py-1.5 text-sm dark:border-zinc-700">Schemalägg +2 min</button>
                </form>
                <form
                  action={async () => {
                    "use server"
                    await scheduleNext(l.id, 5)
                  }}
                >
                  <button className="rounded border px-3 py-1.5 text-sm dark:border-zinc-700">Schemalägg +5 min</button>
                </form>
              </div>

              <p className="mt-2 text-xs text-zinc-500">
                Tips: i prod kan en cron route kolla <code>nextSimAt &le; now()</code> och trigga simulering automatiskt.
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
