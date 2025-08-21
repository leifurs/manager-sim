import { z } from "zod"

// Tillåt både numeriskt (från seed) och strängar från UI.
// Normalisera till tal: Låg=0.3, Normal=0.5, Hög=0.7
const LevelLiteral = z.union([z.literal("Låg"), z.literal("Normal"), z.literal("Hög")])

function normalizeLevel(v: number | string): number {
  if (typeof v === "number") return v // vi antar 0..1 redan
  switch (v) {
    case "Låg":
      return 0.3
    case "Hög":
      return 0.7
    default:
      return 0.5 // Normal
  }
}

export const TacticInputSchema = z
  .object({
    clubId: z.string(), // cuid funkar också, men håll det liberalt
    formation: z.string().min(3),
    style: z.object({
      tempo: z.union([LevelLiteral, z.number()]),
      press: z.union([LevelLiteral, z.number()]),
      line: z.union([LevelLiteral, z.number()])
    })
  })
  .transform(({ clubId, formation, style }) => ({
    clubId,
    formation,
    style: {
      tempo: normalizeLevel(style.tempo),
      press: normalizeLevel(style.press),
      line: normalizeLevel(style.line)
    }
  }))

export type TacticInput = z.infer<typeof TacticInputSchema>
