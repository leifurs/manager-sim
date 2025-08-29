"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { mulberry32 } from "@/lib/rng"
import { getSuspendedForFixture } from "@/lib/disciplineUtil"
import { getInjuredForFixture } from "@/lib/injuryUtil"
import { getCurrentSeasonNumber } from "@/lib/season"

/* ---------- typer & helpers (oförändrat från din version, ev. förkortat här) ---------- */
type GoalEvent = { minute: number; type: "GOAL"; team: "HOME" | "AWAY"; playerId: string; playerName: string; assistPlayerId?: string; assistPlayerName?: string }
type CardEvent = { minute: number; type: "CARD_YELLOW" | "CARD_RED"; team: "HOME" | "AWAY"; playerId: string; playerName: string }
type LineupEvent = { minute: 0; type: "LINEUP"; team: "HOME" | "AWAY"; playerIds: string[] }
type InjuryEvent = { minute: number; type: "INJURY"; team: "HOME" | "AWAY"; playerId: string; playerName: string; gamesOut: number }
type SimEvent = GoalEvent | CardEvent | LineupEvent | InjuryEvent

function avg(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
}
function pickXI<T extends { ovr: number }>(players: T[]) {
  return [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 11)
}
function weightedPick<T>(items: T[], weights: number[], r: () => number): T {
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  let x = r() * sum
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]
    if (x <= 0) return items[i]
  }
  return items[items.length - 1]
}
function simulate(strHome: number, strAway: number, seed: number) {
  const r = mulberry32(seed)
  const totalXg = 2.6 + (r() - 0.5) * 0.4
  const share = 1 / (1 + Math.pow(10, (strAway - strHome) / 25))
  const xgHome = Math.max(0.1, totalXg * share * (0.9 + r() * 0.2))
  const xgAway = Math.max(0.1, totalXg * (1 - share) * (0.9 + r() * 0.2))
  const shoot = (xg: number) => {
    let g = 0
    const chances = 10
    for (let i = 0; i < chances; i++) if (r() < xg / chances) g++
    return g
  }
  return { homeGoals: shoot(xgHome), awayGoals: shoot(xgAway), xgHome: +xgHome.toFixed(2), xgAway: +xgAway.toFixed(2), events: [] as SimEvent[] }
}
function calcRating(opts: { side: "HOME" | "AWAY"; res: { home: number; away: number }; isGK: boolean; goals: number; assists: number; yellows: number; reds: number; cleanSheet: boolean; tactic?: { tempo?: number; press?: number; line?: number } | null }) {
  let r = 6.5
  const won = (opts.side === "HOME" && opts.res.home > opts.res.away) || (opts.side === "AWAY" && opts.res.away > opts.res.home)
  const draw = opts.res.home === opts.res.away
  if (won) r += 0.3
  else if (!draw) r -= 0.2
  r += opts.goals * 1.0
  r += opts.assists * 0.7
  r -= opts.yellows * 0.7
  r -= opts.reds * 1.5
  if (opts.isGK && opts.cleanSheet) r += 0.5
  const tempo = Number(opts.tactic?.tempo ?? 0.5)
  const press = Number(opts.tactic?.press ?? 0.5)
  const line = Number(opts.tactic?.line ?? 0.5)
  if (!opts.isGK && tempo >= 0.6) r += 0.2 * opts.goals
  if (!opts.isGK && press >= 0.6) r += Math.min(0.2, 0.1 * (opts.goals + opts.assists))
  if (opts.isGK && opts.cleanSheet && line >= 0.6) r += 0.2
  if (r < 4.0) r = 4.0
  if (r > 10.0) r = 10.0
  return Math.round(r * 100) / 100
}
function pickPlayerOfTheMatch(args: { events: SimEvent[]; res: { home: number; away: number }; xiH: Array<{ id: string; name: string; pos: string }>; xiA: Array<{ id: string; name: string; pos: string }>; tacticH?: { tempo?: number; press?: number; line?: number } | null; tacticA?: { tempo?: number; press?: number; line?: number } | null }) {
  const { events, res, xiH, xiA, tacticH, tacticA } = args
  type Acc = { side: "HOME" | "AWAY"; name: string; pos: string; g: number; a: number; y: number; r: number }
  const map = new Map<string, Acc>()
  for (const p of xiH) map.set(p.id, { side: "HOME", name: p.name, pos: p.pos, g: 0, a: 0, y: 0, r: 0 })
  for (const p of xiA) map.set(p.id, { side: "AWAY", name: p.name, pos: p.pos, g: 0, a: 0, y: 0, r: 0 })
  for (const e of events) {
    if (e.type === "GOAL") {
      const s = map.get(e.playerId!)
      if (s) s.g++
      if (e.assistPlayerId) {
        const a = map.get(e.assistPlayerId)
        if (a) a.a++
      }
    } else if (e.type === "CARD_YELLOW" || e.type === "CARD_RED") {
      const s = map.get(e.playerId!)
      if (s) e.type === "CARD_YELLOW" ? s.y++ : s.r++
    }
  }
  let top: { id: string; name: string; rating: number } | null = null
  for (const [id, s] of map.entries()) {
    const isGK = s.pos === "GK"
    const cleanSheet = isGK && ((s.side === "HOME" && res.away === 0) || (s.side === "AWAY" && res.home === 0))
    const rating = calcRating({ side: s.side, res, isGK, goals: s.g, assists: s.a, yellows: s.y, reds: s.r, cleanSheet, tactic: s.side === "HOME" ? tacticH : tacticA })
    if (!top || rating > top.rating || (rating === top.rating && s.g > 0)) top = { id, name: s.name, rating }
  }
  return top
}

/* ---------- Huvudfunktioner ---------- */

// Spelar EN fixture om den inte redan är spelad
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

  const [susp, inj] = await Promise.all([getSuspendedForFixture(fixtureId), getInjuredForFixture(fixtureId)])

  const homeAvail = fx.homeClub.players.filter(p => !susp.home.has(p.id) && !inj.home.has(p.id))
  const awayAvail = fx.awayClub.players.filter(p => !susp.away.has(p.id) && !inj.away.has(p.id))

  const avgHome = avg(homeAvail.map(p => p.ovr))
  const avgAway = avg(awayAvail.map(p => p.ovr))
  const styleH = (fx.homeClub.tactic?.styleJson as any) ?? {}
  const styleA = (fx.awayClub.tactic?.styleJson as any) ?? {}
  const bump = (s: any) => ((s?.tempo ?? 0.5) + (s?.press ?? 0.5) + (s?.line ?? 0.5) - 1.5) * 4

  const strHome = avgHome + bump(styleH)
  const strAway = avgAway + bump(styleA)

  const seed = (fx.round * 1_000_003) ^ (parseInt(fx.id.slice(-6), 36) || fx.round * 13)
  const r = mulberry32(seed ^ 0xbeef)

  const sim = simulate(strHome, strAway, seed)
  const xiH = pickXI(homeAvail)
  const xiA = pickXI(awayAvail)

  const weightForScorer = (pos: string, shoot: number) => (pos === "FW" ? 1.0 : pos === "MF" ? 0.6 : pos === "DF" ? 0.25 : 0.05) * (0.5 + (shoot / 100) * 0.5)
  const weightsH = xiH.map(p => weightForScorer(p.pos as any, p.shoot))
  const weightsA = xiA.map(p => weightForScorer(p.pos as any, p.shoot))
  const weightForAssist = (pos: string, pass: number) => (pos === "FW" ? 0.7 : pos === "MF" ? 1.0 : pos === "DF" ? 0.5 : 0.05) * (0.5 + (pass / 100) * 0.5)
  const aWeightsH = xiH.map(p => weightForAssist(p.pos as any, p.pass))
  const aWeightsA = xiA.map(p => weightForAssist(p.pos as any, p.pass))

  const events: SimEvent[] = [
    { minute: 0, type: "LINEUP", team: "HOME", playerIds: xiH.map(p => p.id) },
    { minute: 0, type: "LINEUP", team: "AWAY", playerIds: xiA.map(p => p.id) }
  ]

  const makeGoal = (team: "HOME" | "AWAY") => {
    const isHome = team === "HOME"
    const xi = isHome ? xiH : xiA
    const wSc = isHome ? weightsH : weightsA
    const wAs = isHome ? aWeightsH : aWeightsA
    const scorer = weightedPick(xi, wSc, r)
    let assistId: string | undefined
    let assistName: string | undefined
    if (r() < 0.65) {
      const others = xi.filter(p => p.id !== scorer.id)
      const wOthers = (isHome ? aWeightsH : aWeightsA).filter((_, idx) => xi[idx].id !== scorer.id)
      const assister = weightedPick(others, wOthers, r)
      assistId = assister.id
      assistName = assister.name
    }
    const minute = Math.floor(r() * 90) + 1
    events.push({ minute, type: "GOAL", team, playerId: scorer.id, playerName: scorer.name, assistPlayerId: assistId, assistPlayerName: assistName } as GoalEvent)
  }
  for (let i = 0; i < sim.homeGoals; i++) makeGoal("HOME")
  for (let i = 0; i < sim.awayGoals; i++) makeGoal("AWAY")

  // Kort
  const pickForCard = (team: "HOME" | "AWAY") => {
    const xi = team === "HOME" ? xiH : xiA
    const w = xi.map(p => (p.pos === "DF" ? 1.0 : p.pos === "MF" ? 0.8 : p.pos === "FW" ? 0.5 : 0.2))
    return weightedPick(xi, w, r)
  }
  const yellowCount = Math.floor(r() * 5)
  const redCount = r() < 0.12 ? 1 : 0
  for (let i = 0; i < yellowCount; i++) {
    const team: "HOME" | "AWAY" = r() < 0.5 ? "HOME" : "AWAY"
    const p = pickForCard(team)
    events.push({ minute: Math.floor(r() * 90) + 1, type: "CARD_YELLOW", team, playerId: p.id, playerName: p.name })
  }
  for (let i = 0; i < redCount; i++) {
    const team: "HOME" | "AWAY" = r() < 0.5 ? "HOME" : "AWAY"
    const p = pickForCard(team)
    events.push({ minute: Math.floor(r() * 90) + 1, type: "CARD_RED", team, playerId: p.id, playerName: p.name })
  }

  // ---------- Skador, profil- & taktikstyrt ----------

  type InjuryProfile = "conservative" | "default" | "gritty"
  function getInjuryProfile(): InjuryProfile {
    const p = (process.env.INJURY_PROFILE ?? "default").toLowerCase()
    if (p === "conservative" || p === "gritty") return p
    return "default"
  }

  function getInjuryTuning(profile: InjuryProfile) {
    switch (profile) {
      case "conservative":
        return {
          BASE: 0.3, // total nivå
          intensityWeights: { t: 0.45, p: 0.45, l: 0.1 }, // tempo/press/line
          lambdaScale: (intensity: number) => 0.6 + 0.8 * intensity,
          gamesOutMax: (intensity: number) => 2 + Math.round(intensity * 2), // 1..3(4)
          capPerTeam: 3
        }
      case "gritty":
        return {
          BASE: 0.4,
          intensityWeights: { t: 0.5, p: 0.45, l: 0.05 },
          lambdaScale: (intensity: number) => 0.5 + 1.1 * intensity,
          gamesOutMax: (intensity: number) => 3 + Math.round(intensity * 4), // 1..7
          capPerTeam: 4
        }
      default: // "default"
        return {
          BASE: 0.35,
          intensityWeights: { t: 0.45, p: 0.45, l: 0.1 },
          lambdaScale: (intensity: number) => 0.6 + 0.8 * intensity,
          gamesOutMax: (intensity: number) => 2 + Math.round(intensity * 3), // 1..5
          capPerTeam: 3
        }
    }
  }

  function tacticIntensity(style: any, w: { t: number; p: number; l: number }) {
    const t = Number(style?.tempo ?? 0.5)
    const p = Number(style?.press ?? 0.5)
    const l = Number(style?.line ?? 0.5)
    const score = w.t * t + w.p * p + w.l * l
    return Math.min(1, Math.max(0, score))
  }

  function poisson(lambda: number, rand: () => number) {
    const L = Math.exp(-lambda)
    let k = 0,
      pVal = 1
    do {
      k++
      pVal *= rand()
    } while (pVal > L)
    return Math.max(0, k - 1)
  }

  // Individrisk: stamina↓, ålder↑, DF/MF högre, GK lägst
  function riskWeightFor(p: { pos: string; stamina: number; age: number }) {
    const basePos = p.pos === "DF" ? 1.0 : p.pos === "MF" ? 0.95 : p.pos === "FW" ? 0.85 : 0.45 // GK
    const staminaFactor = 1.0 + (70 - Math.min(70, p.stamina)) / 100 // <70 → upp till +30%
    const ageFactor = 1.0 + Math.max(0, p.age - 28) * 0.03 // >28 → +3%/år
    return basePos * staminaFactor * ageFactor
  }

  function pushInjury(team: "HOME" | "AWAY", xi: typeof xiH, intensity: number, gamesOutMax: number) {
    const weights = xi.map(p => riskWeightFor(p))
    const pInj = weightedPick(xi, weights, r)
    const minute = Math.floor(r() * 90) + 1

    // Frånvaro 1..(1+gamesOutMax)
    const gamesOut = 1 + Math.floor(r() * Math.max(1, gamesOutMax))
    events.push({
      minute,
      type: "INJURY",
      team,
      playerId: pInj.id,
      playerName: pInj.name,
      gamesOut
    } as InjuryEvent)
  }

  // — Profilparametrar
  const PROF = getInjuryProfile()
  const TUNE = getInjuryTuning(PROF)

  const intensityH = tacticIntensity(styleH, TUNE.intensityWeights)
  const intensityA = tacticIntensity(styleA, TUNE.intensityWeights)

  // förväntade skador per lag
  const expectedH = TUNE.BASE * TUNE.lambdaScale(intensityH) * (0.9 + r() * 0.2)
  const expectedA = TUNE.BASE * TUNE.lambdaScale(intensityA) * (0.9 + r() * 0.2)

  // antal skador (med cap)
  const injuryEventsHome = Math.min(poisson(expectedH, r), TUNE.capPerTeam)
  const injuryEventsAway = Math.min(poisson(expectedA, r), TUNE.capPerTeam)

  // skador (hemma/borta)
  for (let i = 0; i < injuryEventsHome; i++) {
    pushInjury("HOME", xiH, intensityH, TUNE.gamesOutMax(intensityH))
  }
  for (let i = 0; i < injuryEventsAway; i++) {
    pushInjury("AWAY", xiA, intensityA, TUNE.gamesOutMax(intensityA))
  }

  // sortera händelser efter minut
  events.sort((a, b) => a.minute - b.minute)

  const potm = pickPlayerOfTheMatch({
    events,
    res: { home: sim.homeGoals, away: sim.awayGoals },
    xiH: xiH.map(p => ({ id: p.id, name: p.name, pos: p.pos as string })),
    xiA: xiA.map(p => ({ id: p.id, name: p.name, pos: p.pos as string })),
    tacticH: styleH,
    tacticA: styleA
  })

  const saved = await prisma.match.create({
    data: {
      fixtureId: fx.id,
      season: fx.season,
      seed,
      resultJson: {
        home: sim.homeGoals,
        away: sim.awayGoals,
        potm: potm ? { playerId: potm.id, name: potm.name, rating: potm.rating } : null
      },
      eventsJson: events,
      xgHome: sim.xgHome,
      xgAway: sim.xgAway
    }
  })
  await prisma.fixture.update({ where: { id: fx.id }, data: { status: "PLAYED" } })

  revalidatePath("/fixtures")
  revalidatePath(`/fixtures/${fx.id}`)
  revalidatePath("/fixtures/rounds")
  revalidatePath("/table")
  revalidatePath("/stats/scorers")
  revalidatePath("/stats/assists")
  revalidatePath("/stats/keepers")
  revalidatePath("/stats/discipline")

  return { ok: true, matchId: saved.id }
}

// Spela HEL omgång (aktuella säsongen)
export async function simulateRound(leagueId: string, round: number) {
  const season = await getCurrentSeasonNumber(leagueId)
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, season, round, status: "SCHEDULED" },
    select: { id: true },
    orderBy: { kickoffAt: "asc" }
  })
  for (const f of fixtures) {
    await simulateFixture(f.id)
  }
  revalidatePath("/fixtures")
  revalidatePath("/fixtures/rounds")
  revalidatePath("/table")
  return { ok: true, count: fixtures.length }
}

// Spela RESTEN av säsongen (alla kvarvarande SCHEDULED i aktuell säsong)
export async function simulateRemainingSeason(leagueId: string) {
  const season = await getCurrentSeasonNumber(leagueId)
  const fixtures = await prisma.fixture.findMany({
    where: { leagueId, season, status: "SCHEDULED" },
    select: { id: true },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }]
  })
  for (const f of fixtures) {
    await simulateFixture(f.id)
  }
  revalidatePath("/fixtures")
  revalidatePath("/fixtures/rounds")
  revalidatePath("/table")
  return { ok: true, count: fixtures.length }
}
