// src/components/InjuryBadge.tsx
type Profile = "conservative" | "default" | "gritty"

function readProfile(): Profile {
  const v = (process.env.INJURY_PROFILE ?? "default").toLowerCase()
  return v === "conservative" || v === "gritty" ? v : "default"
}

export default function InjuryBadge({ className = "" }: { className?: string }) {
  const profile = readProfile()
  const label = profile === "gritty" ? "Skador: Gritty" : profile === "conservative" ? "Skador: Konservativ" : "Skador: Standard"

  const tone = profile === "gritty" ? "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800/60" : profile === "conservative" ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/60" : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:ring-zinc-800/60"

  const hint = "Styrs av .env → INJURY_PROFILE (conservative | default | gritty)."

  return (
    <span title={hint} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ${tone} ${className}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}
