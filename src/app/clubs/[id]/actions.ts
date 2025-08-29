// src/app/clubs/[id]/actions.ts
"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

// -------- Helpers ----------
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
function effOVR(p: { ovr: number; fatigue?: number | null; form?: number | null }) {
  const f = clamp(Number(p.fatigue ?? 0), 0, 100)
  const form = clamp(Number(p.form ?? 0), -3, 3)
  const fatiguePenalty = 1 - f * 0.002 // -0..-0.2
  return Math.max(1, Math.round(p.ovr * fatiguePenalty + form * 2))
}

// SubPositions vi använder i lineup
type Sub = "GK" | "CB" | "LB" | "RB" | "CM" | "DM" | "AM" | "ST" | "LW" | "RW"

// Definition av formationer → lista av positions-“spots” i ordning
const FORMATIONS: Record<string, { label: string; spots: Sub[] }> = {
  "4-3-3": {
    label: "4-3-3",
    spots: ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "AM", "LW", "ST", "RW"]
  },
  "4-2-3-1": {
    label: "4-2-3-1",
    spots: ["GK", "LB", "CB", "CB", "RB", "DM", "CM", "LW", "AM", "RW", "ST"]
  },
  "4-4-2": {
    label: "4-4-2",
    spots: ["GK", "LB", "CB", "CB", "RB", "LW", "CM", "CM", "RW", "ST", "ST"]
  },
  "3-5-2": {
    label: "3-5-2",
    spots: ["GK", "CB", "CB", "CB", "LM" as any, "CM", "CM", "CM", "RM" as any, "ST", "ST"]
  }
}

// För 3-5-2 använder vi LM≈LW och RM≈RW som fallback (vi mappar LM→LW, RM→RW)
const NORMALIZE: Partial<Record<string, Sub>> = {
  LM: "LW",
  RM: "RW"
} as const

function normSub(s: string): Sub {
  return (NORMALIZE[s] ?? s) as Sub
}

function mainFromSub(s: Sub): "GK" | "DF" | "MF" | "FW" {
  if (s === "GK") return "GK"
  if (s === "CB" || s === "LB" || s === "RB") return "DF"
  if (s === "CM" || s === "DM" || s === "AM") return "MF"
  return "FW" // ST | LW | RW
}

// -------- Server action (form) ----------
// Används som: <form action={suggestLineup.bind(null, clubId)}><input name="formation" ... />
export async function suggestLineup(clubId: string, formData: FormData) {
  // formation från form, eller befintlig tactic.formation, eller default 4-3-3
  let formation = (formData.get("formation") as string | null)?.trim()
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    include: { players: true, tactic: true }
  })
  if (!club) redirect("/clubs")

  if (!formation || !FORMATIONS[formation]) {
    formation = club.tactic?.formation && FORMATIONS[club.tactic.formation] ? club.tactic.formation : "4-3-3"
  }

  // Förbered spelare med eff
  const players = club.players.map(p => ({
    id: p.id,
    name: (p as any).name ?? null,
    // huvudposition (fallback om sub ej matchar)
    pos: p.pos as "GK" | "DF" | "MF" | "FW",
    subPos: (p as any).subPos as Sub | undefined,
    ovr: p.ovr,
    fatigue: (p as any).fatigue ?? 0,
    form: (p as any).form ?? 0,
    eff: 0
  }))
  for (const p of players) p.eff = effOVR(p)

  // Indexera
  const bySub = new Map<Sub, typeof players>()
  const byMain: Record<"GK" | "DF" | "MF" | "FW", typeof players> = { GK: [], DF: [], MF: [], FW: [] }
  for (const p of players) {
    const s = (p.subPos ?? p.pos) as Sub
    if (!bySub.has(s)) bySub.set(s, [])
    bySub.get(s)!.push(p)
    byMain[p.pos].push(p)
  }
  for (const list of bySub.values()) list.sort((a, b) => b.eff - a.eff)
  for (const k of ["GK", "DF", "MF", "FW"] as const) byMain[k].sort((a, b) => b.eff - a.eff)

  const picked = new Set<string>()
  const groups: Record<"GK" | "DF" | "MF" | "FW", string[]> = { GK: [], DF: [], MF: [], FW: [] }

  // helper: ta bästa spelaren för given subPos; fallbacks: annan sub i samma huvudpos → bästa i huvudpos
  const takeForSpot = (sub: Sub) => {
    const normalized = normSub(sub)
    const main = mainFromSub(normalized)
    // 1) försök exakt sub
    const exact = (bySub.get(normalized) ?? []).find(p => !picked.has(p.id))
    if (exact) {
      groups[main].push(exact.id)
      picked.add(exact.id)
      return
    }
    // 2) annars: bästa kvar i huvudposition
    const fb = byMain[main].find(p => !picked.has(p.id))
    if (fb) {
      groups[main].push(fb.id)
      picked.add(fb.id)
      return
    }
    // 3) sista fallback: bästa kvar oavsett
    const any = [...players].filter(p => !picked.has(p.id)).sort((a, b) => b.eff - a.eff)[0]
    if (any) {
      const m = pMain(any)
      groups[m].push(any.id)
      picked.add(any.id)
    }
  }

  function pMain(p: { pos: "GK" | "DF" | "MF" | "FW" }) {
    return p.pos
  }

  // Plocka i turordning enligt formationens spots
  const spots = FORMATIONS[formation].spots.map(normSub)
  for (const s of spots) takeForSpot(s)

  // Spara tactic: formation + lineup (som buckets per huvudposition)
  const baseStyle = (club.tactic?.styleJson as any) ?? { tempo: 0.5, press: 0.5, line: 0.5 }
  const nextStyle = { ...baseStyle, lineup: groups }
  await prisma.tactic.upsert({
    where: { clubId },
    update: { formation, styleJson: nextStyle },
    create: { clubId, formation, styleJson: nextStyle }
  })

  revalidatePath(`/clubs/${clubId}`)
  redirect(`/clubs/${clubId}?done=lineup`)
}
