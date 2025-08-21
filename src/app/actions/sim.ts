"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { mulberry32 } from "@/lib/rng"

type SimResult = { homeGoals: number; awayGoals: number; xgHome: number; xgAway: number; events: any[] }

function avg(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
}

// Enkel simulator: styrka → xG → mål.
function simulate(strHome: number, strAway: number, seed: number): SimResult {
  const rnd = mulberry32(seed)

  // Bas-xG från relativ styrka
  const totalXg = 2.6 + (rnd() - 0.5) * 0.4 // 2.6 ± 0.2
  const share = 1 / (1 + Math.pow(10, (strAway - strHome) / 25)) // ELO-liknande
  let xgHome = totalXg * share
  let xgAway = totalXg * (1 - share)

  // Lite brus
  xgHome = Math.max(0.1, xgHome * (0.9 + rnd() * 0.2))
  xgAway = Math.max(0.1, xgAway * (0.9 + rnd() * 0.2))

  // Diskretisera mål via "Bernoulli-chancer": 10 chanser = ~Poisson-ish
  const goals = (xg: number) => {
    let g = 0
    const chances = 10
    for (let i = 0; i < chances; i++) {
      const p = xg / chances // sannolikhet att chans blir mål
      if (rnd() < p) g++
    }
    return g
  }

  const homeGoals = goals(xgHome)
  const awayGoals = goals(xgAway)

  // Dummy-events
  const events = []
  for (let i = 0; i < homeGoals + awayGoals; i++) {
    events.push({ minute: Math.floor(rnd() * 90) + 1, type: "GOAL", team: rnd() < homeGoals / (homeGoals + awayGoals || 1) ? "HOME" : "AWAY" })
  }
  events.sort((a, b) => a.minute - b.minute)

  return { homeGoals, awayGoals, xgHome: +xgHome.toFixed(2), xgAway: +xgAway.toFixed(2), events }
}

export async function simulateFixture(fixtureId: string) {
  // Hämta fixture + data
  const fx = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      homeClub: { include: { players: true, tactic: true } },
      awayClub: { include: { players: true, tactic: true } },
      match: true
    }
  })

  if (!fx) return { error: "Matchen finns inte" }
  if (fx.match) return { ok: true, alreadyPlayed: true } // redan spelad

  // Styrka = medel-OVR + små taktiska påslag (tempo/press/line i 0..1)
  const avgHome = avg(fx.homeClub.players.map(p => p.ovr))
  const avgAway = avg(fx.awayClub.players.map(p => p.ovr))
  const styleH = (fx.homeClub.tactic?.styleJson as any) ?? {}
  const styleA = (fx.awayClub.tactic?.styleJson as any) ?? {}

  const bump = (s: any) => ((s?.tempo ?? 0.5) + (s?.press ?? 0.5) + (s?.line ?? 0.5) - 1.5) * 4 // -2..+2
  const strHome = avgHome + bump(styleH)
  const strAway = avgAway + bump(styleA)

  // Seed från fixture-id (stabilt) + vecka
  const seed = (fx.round * 1_000_003) ^ parseInt(fx.id.slice(-6), 36) || fx.round * 13
  const result = simulate(strHome, strAway, seed)

  const saved = await prisma.match.create({
    data: {
      fixtureId: fx.id,
      seed,
      resultJson: { home: result.homeGoals, away: result.awayGoals },
      eventsJson: result.events,
      xgHome: result.xgHome,
      xgAway: result.xgAway
    }
  })

  await prisma.fixture.update({ where: { id: fx.id }, data: { status: "PLAYED" } })

  // revalidera listor/detalj
  revalidatePath("/fixtures")
  revalidatePath(`/fixtures/${fx.id}`)
  revalidatePath("/table")

  return { ok: true, matchId: saved.id, ...result }
}
