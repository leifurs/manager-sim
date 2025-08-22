"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { mulberry32 } from "@/lib/rng"

type SimResult = {
  homeGoals: number
  awayGoals: number
  xgHome: number
  xgAway: number
  // utökar event med playerId/playerName
  events: Array<{ minute: number; type: string; team: "HOME" | "AWAY"; playerId?: string; playerName?: string }>
}

function avg(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
}

// Hjälp: välj startelva = topp 11 på OVR
function pickXI<T extends { ovr: number }>(players: T[]) {
  return [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 11)
}

// Slump i [0,1)
function rnd01(seedRef: { r: () => number }) {
  return seedRef.r()
}

// Viktad lottning efter vikt-array
function weightedPick<T>(items: T[], weights: number[], r: () => number): T {
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  let x = r() * sum
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]
    if (x <= 0) return items[i]
  }
  return items[items.length - 1]
}

function simulate(strHome: number, strAway: number, seed: number): SimResult {
  const r = mulberry32(seed)

  const totalXg = 2.6 + (r() - 0.5) * 0.4 // 2.6 ± 0.2
  const share = 1 / (1 + Math.pow(10, (strAway - strHome) / 25)) // ELO-liknande
  let xgHome = totalXg * share
  let xgAway = totalXg * (1 - share)

  xgHome = Math.max(0.1, xgHome * (0.9 + r() * 0.2))
  xgAway = Math.max(0.1, xgAway * (0.9 + r() * 0.2))

  const goals = (xg: number) => {
    let g = 0
    const chances = 10
    for (let i = 0; i < chances; i++) {
      const p = xg / chances
      if (r() < p) g++
    }
    return g
  }

  const homeGoals = goals(xgHome)
  const awayGoals = goals(xgAway)

  const events: SimResult["events"] = []
  // FYLLER spelare senare i simulateFixture (vi vet inte XI här)
  // men vi skapar placeholders för antal mål och minuter så länge
  for (let i = 0; i < homeGoals; i++) {
    events.push({ minute: Math.floor(r() * 90) + 1, type: "GOAL", team: "HOME" })
  }
  for (let i = 0; i < awayGoals; i++) {
    events.push({ minute: Math.floor(r() * 90) + 1, type: "GOAL", team: "AWAY" })
  }
  events.sort((a, b) => a.minute - b.minute)

  return { homeGoals, awayGoals, xgHome: +xgHome.toFixed(2), xgAway: +xgAway.toFixed(2), events }
}

export async function simulateFixture(fixtureId: string) {
  const fx = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      homeClub: { include: { players: true, tactic: true } },
      awayClub: { include: { players: true, tactic: true } },
      match: true
    }
  })

  if (!fx) return { error: "Matchen finns inte" }
  if (fx.match) return { ok: true, alreadyPlayed: true }

  const avgHome = avg(fx.homeClub.players.map(p => p.ovr))
  const avgAway = avg(fx.awayClub.players.map(p => p.ovr))
  const styleH = (fx.homeClub.tactic?.styleJson as any) ?? {}
  const styleA = (fx.awayClub.tactic?.styleJson as any) ?? {}
  const bump = (s: any) => ((s?.tempo ?? 0.5) + (s?.press ?? 0.5) + (s?.line ?? 0.5) - 1.5) * 4

  const strHome = avgHome + bump(styleH)
  const strAway = avgAway + bump(styleA)

  const seed = (fx.round * 1_000_003) ^ (parseInt(fx.id.slice(-6), 36) || fx.round * 13)
  const sim = simulate(strHome, strAway, seed)

  // Välj startelvor
  const xiH = pickXI(fx.homeClub.players)
  const xiA = pickXI(fx.awayClub.players)

  // Bygg vikter för mål: anfall > mittfält > försvar > målvakt, skala med shoot
  const weightFor = (pos: string, shoot: number) => {
    const base = pos === "FW" ? 1.0 : pos === "MF" ? 0.6 : pos === "DF" ? 0.25 : pos === "GK" ? 0.05 : 0.3
    return base * (0.5 + (shoot / 100) * 0.5) // shoot 0..100 → 0.5..1.0
  }

  const weightsH = xiH.map(p => weightFor(p.pos as any, p.shoot))
  const weightsA = xiA.map(p => weightFor(p.pos as any, p.shoot))
  const r = mulberry32(seed ^ 0xbeef)

  // Tilldela målskyttar
  for (const e of sim.events) {
    if (e.type !== "GOAL") continue
    if (e.team === "HOME") {
      const scorer = weightedPick(xiH, weightsH, r)
      e.playerId = scorer.id
      e.playerName = `#${(scorer as any).id.slice(0, 4)} ${posShort(scorer.pos)} OVR${scorer.ovr}`
    } else {
      const scorer = weightedPick(xiA, weightsA, r)
      e.playerId = scorer.id
      e.playerName = `#${(scorer as any).id.slice(0, 4)} ${posShort(scorer.pos)} OVR${scorer.ovr}`
    }
  }

  const saved = await prisma.match.create({
    data: {
      fixtureId: fx.id,
      seed,
      resultJson: { home: sim.homeGoals, away: sim.awayGoals },
      eventsJson: sim.events,
      xgHome: sim.xgHome,
      xgAway: sim.xgAway
    }
  })

  await prisma.fixture.update({ where: { id: fx.id }, data: { status: "PLAYED" } })

  // revalidera sidor
  revalidatePath("/fixtures")
  revalidatePath(`/fixtures/${fx.id}`)
  revalidatePath("/table")
  revalidatePath("/stats/scorers") // ⬅️ NYTT

  return { ok: true, matchId: saved.id, ...sim }
}

function posShort(pos: string) {
  switch (pos) {
    case "GK":
      return "GK"
    case "DF":
      return "DF"
    case "MF":
      return "MF"
    case "FW":
      return "FW"
    default:
      return pos
  }
}
