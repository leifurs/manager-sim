// src/app/admin/settings/page.tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin – Inställningar | ManagerSim",
  description: "Översikt av serverinställningar för simulatorn."
}

// Hämta serverns profil (den som styr simuleringen)
function readServerProfile(): "conservative" | "default" | "gritty" {
  const v = (process.env.INJURY_PROFILE ?? "default").toLowerCase()
  return v === "conservative" || v === "gritty" ? v : "default"
}

type Tune = {
  BASE: number
  intensityWeights: { t: number; p: number; l: number }
  lambdaScaleDesc: string
  gamesOutDesc: string
  capPerTeam: number
}

function getTuning(profile: "conservative" | "default" | "gritty"): Tune {
  switch (profile) {
    case "conservative":
      return {
        BASE: 0.3,
        intensityWeights: { t: 0.45, p: 0.45, l: 0.1 },
        lambdaScaleDesc: "λ = BASE × (0.6 + 0.8 × intensitet)",
        gamesOutDesc: "Frånvaro 1–4 matcher (oftare kortare)",
        capPerTeam: 3
      }
    case "gritty":
      return {
        BASE: 0.4,
        intensityWeights: { t: 0.5, p: 0.45, l: 0.05 },
        lambdaScaleDesc: "λ = BASE × (0.5 + 1.1 × intensitet)",
        gamesOutDesc: "Frånvaro 1–7 matcher (oftare längre)",
        capPerTeam: 4
      }
    default:
      return {
        BASE: 0.35,
        intensityWeights: { t: 0.45, p: 0.45, l: 0.1 },
        lambdaScaleDesc: "λ = BASE × (0.6 + 0.8 × intensitet)",
        gamesOutDesc: "Frånvaro 1–5 matcher",
        capPerTeam: 3
      }
  }
}

export default async function AdminSettingsPage() {
  const profile = readServerProfile()
  const tune = getTuning(profile)

  const label = profile === "gritty" ? "Gritty" : profile === "conservative" ? "Konservativ" : "Standard"

  const chipTone = profile === "gritty" ? "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800/60" : profile === "conservative" ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/60" : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:ring-zinc-800/60"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin – Inställningar</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Läs-bara översikt över serverns simuleringsparametrar.</p>
      </div>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Skadeprofil</h2>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ${chipTone}`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            Skador: {label}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Basnivå</div>
            <div className="text-sm">
              BASE = <span className="tabular-nums">{tune.BASE.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Högre BASE ⇒ fler skador totalt per lag och match.</p>
          </div>

          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Intensitetsviktning</div>
            <div className="text-sm">
              tempo: {tune.intensityWeights.t}, press: {tune.intensityWeights.p}, linje: {tune.intensityWeights.l}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{tune.lambdaScaleDesc}</div>
          </div>

          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Frånvaro</div>
            <div className="text-sm">{tune.gamesOutDesc}</div>
          </div>

          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Max per lag & match</div>
            <div className="text-sm">{tune.capPerTeam} skador</div>
          </div>
        </div>

        <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/50">
          Denna vy speglar serverns <code className="px-1">INJURY_PROFILE</code>. Ändra i <code className="px-1">.env</code> och starta om servern:
          <pre className="mt-1 whitespace-pre-wrap rounded bg-white/60 p-2 text-[11px] text-zinc-800 ring-1 ring-amber-200 dark:bg-zinc-900/60 dark:text-zinc-100 dark:ring-amber-800/30">{`INJURY_PROFILE=conservative   # eller default | gritty`}</pre>
        </div>
      </section>
    </div>
  )
}
