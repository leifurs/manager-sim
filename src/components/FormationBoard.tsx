// src/components/FormationBoard.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { saveLineup } from "@/app/clubs/[id]/lineupActions"

type Player = {
  id: string
  name: string
  subPos: string | null
  ovr: number
}

type Spot = {
  id: string // unikt id per ruta
  label: string // text i rutan (GK/LB/CB/…)
  main: "GK" | "DF" | "MF" | "FW" // för grupper när vi sparar
  x: number // procent från vänster
  y: number // procent från toppen
}

/** Planlayout per formation */
const FORMATION_SPOTS: Record<string, Spot[]> = {
  "4-3-3": [
    { id: "GK1", label: "GK", main: "GK", x: 50, y: 90 },
    { id: "LB1", label: "LB", main: "DF", x: 15, y: 70 },
    { id: "CB1", label: "CB", main: "DF", x: 35, y: 70 },
    { id: "CB2", label: "CB", main: "DF", x: 65, y: 70 },
    { id: "RB1", label: "RB", main: "DF", x: 85, y: 70 },
    { id: "CM1", label: "CM", main: "MF", x: 30, y: 50 },
    { id: "CM2", label: "CM", main: "MF", x: 50, y: 50 },
    { id: "AM1", label: "AM", main: "MF", x: 70, y: 50 },
    { id: "LW1", label: "LW", main: "FW", x: 20, y: 25 },
    { id: "ST1", label: "ST", main: "FW", x: 50, y: 20 },
    { id: "RW1", label: "RW", main: "FW", x: 80, y: 25 }
  ],
  "4-2-3-1": [
    { id: "GK1", label: "GK", main: "GK", x: 50, y: 90 },
    { id: "LB1", label: "LB", main: "DF", x: 15, y: 72 },
    { id: "CB1", label: "CB", main: "DF", x: 35, y: 72 },
    { id: "CB2", label: "CB", main: "DF", x: 65, y: 72 },
    { id: "RB1", label: "RB", main: "DF", x: 85, y: 72 },
    { id: "DM1", label: "DM", main: "MF", x: 40, y: 58 },
    { id: "CM1", label: "CM", main: "MF", x: 60, y: 58 },
    { id: "LW1", label: "LW", main: "FW", x: 22, y: 38 },
    { id: "AM1", label: "AM", main: "MF", x: 50, y: 38 },
    { id: "RW1", label: "RW", main: "FW", x: 78, y: 38 },
    { id: "ST1", label: "ST", main: "FW", x: 50, y: 22 }
  ],
  "4-4-2": [
    { id: "GK1", label: "GK", main: "GK", x: 50, y: 90 },
    { id: "LB1", label: "LB", main: "DF", x: 15, y: 72 },
    { id: "CB1", label: "CB", main: "DF", x: 35, y: 72 },
    { id: "CB2", label: "CB", main: "DF", x: 65, y: 72 },
    { id: "RB1", label: "RB", main: "DF", x: 85, y: 72 },
    { id: "LM1", label: "LM", main: "MF", x: 22, y: 50 },
    { id: "CM1", label: "CM", main: "MF", x: 42, y: 50 },
    { id: "CM2", label: "CM", main: "MF", x: 58, y: 50 },
    { id: "RM1", label: "RM", main: "MF", x: 78, y: 50 },
    { id: "ST1", label: "ST", main: "FW", x: 42, y: 28 },
    { id: "ST2", label: "ST", main: "FW", x: 58, y: 28 }
  ],
  "3-5-2": [
    { id: "GK1", label: "GK", main: "GK", x: 50, y: 90 },
    { id: "CB1", label: "CB", main: "DF", x: 30, y: 72 },
    { id: "CB2", label: "CB", main: "DF", x: 50, y: 72 },
    { id: "CB3", label: "CB", main: "DF", x: 70, y: 72 },
    { id: "LM1", label: "LM", main: "MF", x: 18, y: 50 },
    { id: "CM1", label: "CM", main: "MF", x: 38, y: 50 },
    { id: "CM2", label: "CM", main: "MF", x: 50, y: 44 },
    { id: "CM3", label: "CM", main: "MF", x: 62, y: 50 },
    { id: "RM1", label: "RM", main: "MF", x: 82, y: 50 },
    { id: "ST1", label: "ST", main: "FW", x: 44, y: 28 },
    { id: "ST2", label: "ST", main: "FW", x: 56, y: 28 }
  ]
}

/** vilka subPos är godkända för en given spot-label */
const COMPATIBLE: Record<string, string[]> = {
  GK: ["GK"],
  LB: ["LB"],
  RB: ["RB"],
  CB: ["CB"],
  CM: ["CM", "DM", "AM"],
  DM: ["DM", "CM"],
  AM: ["AM", "CM"],
  LW: ["LW"],
  RW: ["RW"],
  ST: ["ST"],
  // “LM/RM” (från 4-4-2 & 3-5-2) – vi accepterar LW/RW
  LM: ["LW", "CM"], // CM tillåts som svag fallback
  RM: ["RW", "CM"]
}

function mainFromSub(sub: string | null): "GK" | "DF" | "MF" | "FW" | null {
  if (!sub) return null
  if (sub === "GK") return "GK"
  if (["CB", "LB", "RB"].includes(sub)) return "DF"
  if (["CM", "DM", "AM", "LM", "RM"].includes(sub)) return "MF"
  if (["ST", "LW", "RW"].includes(sub)) return "FW"
  return null
}

export default function FormationBoard({
  clubId,
  formation,
  players,
  initialGroups
}: {
  clubId: string
  formation: string
  players: Player[]
  /** prefill från tactic.styleJson.lineup: { GK:[], DF:[], MF:[], FW:[] } */
  initialGroups?: Partial<Record<"GK" | "DF" | "MF" | "FW", string[]>>
}) {
  const spots = useMemo(() => FORMATION_SPOTS[formation] ?? [], [formation])
  const [lineupBySpot, setLineupBySpot] = useState<Record<string, string[]>>({})
  const [errorSpot, setErrorSpot] = useState<string | null>(null)

  // Prefill: lägg spelare i spot-ordning inom samma main-grupp
  useEffect(() => {
    const next: Record<string, string[]> = {}
    const pool = {
      GK: [...(initialGroups?.GK ?? [])],
      DF: [...(initialGroups?.DF ?? [])],
      MF: [...(initialGroups?.MF ?? [])],
      FW: [...(initialGroups?.FW ?? [])]
    }
    for (const s of spots) {
      const id = pool[s.main].shift()
      next[s.id] = id ? [id] : []
    }
    setLineupBySpot(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formation, spots.length])

  function assignPlayerToSpot(playerId: string, spotId: string) {
    const next: Record<string, string[]> = {}
    for (const k of Object.keys(lineupBySpot)) {
      next[k] = lineupBySpot[k].filter(id => id !== playerId)
    }
    next[spotId] = [playerId]
    setLineupBySpot(next)
  }

  function canDrop(player: Player, spotLabel: string) {
    const allow = COMPATIBLE[spotLabel] ?? []
    if (allow.length === 0) return true // defensivt
    const sp = player.subPos ?? ""
    if (allow.includes(sp)) return true
    // mjuk fallback: rätt huvudposition men “fel” sub → tillåt (manuellt finlir)
    const playerMain = mainFromSub(sp)
    const spotMain = (() => {
      if (["LB", "CB", "RB"].includes(spotLabel)) return "DF"
      if (["CM", "DM", "AM", "LM", "RM"].includes(spotLabel)) return "MF"
      if (["ST", "LW", "RW"].includes(spotLabel)) return "FW"
      if (spotLabel === "GK") return "GK"
      return null
    })()
    return playerMain && spotMain && playerMain === spotMain
  }

  async function handleSave() {
    const groups: Record<"GK" | "DF" | "MF" | "FW", string[]> = { GK: [], DF: [], MF: [], FW: [] }
    const meta = new Map(spots.map(s => [s.id, s]))
    for (const [spotId, ids] of Object.entries(lineupBySpot)) {
      const m = meta.get(spotId)
      if (!m) continue
      for (const id of ids) groups[m.main].push(id)
    }
    await saveLineup(clubId, formation, groups)
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto h-[520px] w-[360px] rounded-lg bg-green-700 p-2 sm:h-[560px] sm:w-[480px] lg:h-[640px] lg:w-[560px]">
        {spots.map(spot => {
          const pid = (lineupBySpot[spot.id] ?? [])[0]
          const player = players.find(p => p.id === pid)

          return (
            <div
              key={spot.id}
              className={`absolute flex h-12 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded text-xs shadow
                ${errorSpot === spot.id ? "animate-pulse ring-2 ring-red-500" : ""}
                bg-white/90 text-black dark:bg-zinc-100`}
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const id = e.dataTransfer.getData("player")
                if (!id) return
                const p = players.find(pp => pp.id === id)
                if (!p || !canDrop(p, spot.label)) {
                  setErrorSpot(spot.id)
                  setTimeout(() => setErrorSpot(null), 800)
                  return
                }
                assignPlayerToSpot(id, spot.id)
              }}
              title={spot.label}
            >
              {player ? (
                <div className="flex w-full items-center justify-between gap-2 px-2">
                  <span className="truncate">{player.name}</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">{player.ovr}</span>
                </div>
              ) : (
                <span className="text-zinc-700">{spot.label}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Bänk */}
      <div className="flex flex-wrap gap-2">
        {players.map(p => {
          const used = Object.values(lineupBySpot).some(ids => ids.includes(p.id))
          const main = mainFromSub(p.subPos)
          const color = main === "DF" ? "bg-blue-600" : main === "MF" ? "bg-amber-600" : main === "FW" ? "bg-rose-600" : "bg-zinc-600"

          return (
            <div key={p.id} draggable onDragStart={e => e.dataTransfer.setData("player", p.id)} className={`cursor-move rounded border px-2 py-1 text-xs dark:bg-zinc-900 ${used ? "opacity-40" : "bg-white"}`} title={`${p.name} (${p.subPos ?? ""}) ${p.ovr}`}>
              <span className="mr-1 inline-block rounded px-1 text-[10px] font-semibold text-white align-middle ${color}">{p.subPos ?? main ?? ""}</span>
              {p.name} · {p.ovr}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500">
          Spara lineup
        </button>
        <span className="text-xs text-zinc-500">Dra spelare från bänken in i rutor. Ogiltig drop blinkar rött.</span>
      </div>
    </div>
  )
}
