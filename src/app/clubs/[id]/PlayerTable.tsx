// src/app/clubs/[id]/PlayerTable.tsx
"use client"

import Link from "next/link"

type PlayerRow = {
  id: string
  name: string | null
  pos: "GK" | "DF" | "MF" | "FW"
  subPos?: string | null
  ovr: number
  pace: number
  pass: number
  shoot: number
  defend: number
  gk: number
  fatigue?: number
  form?: number
}

function posLabel(pos: string) {
  switch (pos) {
    case "GK":
      return "Målvakt"
    case "DF":
      return "Försvar"
    case "MF":
      return "Mittfält"
    case "FW":
      return "Anfall"
    default:
      return pos
  }
}

export default function PlayerTable({ players }: { players: PlayerRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-zinc-900">
          <tr className="text-left border-b dark:border-zinc-800">
            {/* ID borttagen */}
            <th className="py-2 pr-3">Spelare</th>
            <th className="py-2 pr-3">Roll</th>
            <th className="py-2 pr-3">Pos</th>
            <th className="py-2 pr-3">OVR</th>
            <th className="py-2 pr-3">PACE</th>
            <th className="py-2 pr-3">PASS</th>
            <th className="py-2 pr-3">SHOOT</th>
            <th className="py-2 pr-3">DEF</th>
            <th className="py-2 pr-3">GK</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={p.id} className={`border-b dark:border-zinc-800 ${i % 2 ? "bg-gray-50 dark:bg-zinc-950/40" : ""}`}>
              <td className="py-1 pr-3">
                <Link href={`/players/${p.id}`} className="underline underline-offset-2">
                  {p.name ?? "Okänd spelare"}
                </Link>
              </td>
              <td className="py-1 pr-3">{p.subPos ?? "–"}</td>
              <td className="py-1 pr-3">{posLabel(p.pos)}</td>
              <td className="py-1 pr-3 font-medium tabular-nums">{p.ovr}</td>
              <td className="py-1 pr-3 tabular-nums">{p.pace}</td>
              <td className="py-1 pr-3 tabular-nums">{p.pass}</td>
              <td className="py-1 pr-3 tabular-nums">{p.shoot}</td>
              <td className="py-1 pr-3 tabular-nums">{p.defend}</td>
              <td className="py-1 pr-3 tabular-nums">{p.gk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
