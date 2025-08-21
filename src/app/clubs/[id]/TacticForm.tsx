"use client"

import { useState } from "react"
import { updateTactic } from "@/app/actions/tactic"

// Tillåt bred input från Prisma (JsonValue | null).
type InitialTactic = {
  formation?: string | null
  styleJson?: unknown
}

function asNum(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined
}

function numToLevel(n: number | undefined): "Låg" | "Normal" | "Hög" {
  if (typeof n !== "number") return "Normal"
  if (n <= 0.35) return "Låg"
  if (n >= 0.65) return "Hög"
  return "Normal"
}

export default function TacticForm({ clubId, initial }: { clubId: string; initial?: InitialTactic | null }) {
  const style = (initial as any)?.styleJson as Record<string, unknown> | undefined

  const [formation, setFormation] = useState(initial?.formation ?? "4-4-2")
  const [tempo, setTempo] = useState<"Låg" | "Normal" | "Hög">(numToLevel(asNum(style?.tempo)))
  const [press, setPress] = useState<"Låg" | "Normal" | "Hög">(numToLevel(asNum(style?.press)))
  const [line, setLine] = useState<"Låg" | "Normal" | "Hög">(numToLevel(asNum(style?.line)))
  const [message, setMessage] = useState<string>("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")
    const res = await updateTactic({
      clubId,
      formation,
      style: { tempo, press, line } // strängar → normaliseras till tal på servern
    })
    if (res?.error) setMessage(res.error)
    else setMessage("✅ Taktik sparad")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="font-semibold">Taktik</h2>

      <div>
        <label className="block text-sm mb-1">Formation</label>
        <input
          value={formation}
          onChange={e => setFormation(e.target.value)}
          className="w-full rounded border px-3 py-2
                     bg-white text-gray-900 placeholder:text-gray-400
                     dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Tempo", value: tempo, setter: setTempo },
          { label: "Press", value: press, setter: setPress },
          { label: "Backlinje", value: line, setter: setLine }
        ].map(f => (
          <div key={f.label}>
            <label className="block text-sm mb-1">{f.label}</label>
            <select
              value={f.value}
              onChange={e => f.setter(e.target.value as any)}
              className="w-full rounded border px-3 py-2
                         bg-white text-gray-900
                         dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
            >
              <option>Låg</option>
              <option>Normal</option>
              <option>Hög</option>
            </select>
          </div>
        ))}
      </div>

      <button
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700
                   disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Spara
      </button>
      {message && <p className="text-sm mt-2">{message}</p>}
    </form>
  )
}
