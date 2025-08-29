// src/components/Toast.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

function parseDone(value: string | null): string | null {
  if (!value) return null
  if (value === "match") return "Match spelad ✓"
  if (value.startsWith("season:")) {
    const [, n] = value.split(":")
    const count = Number(n || 0)
    return count > 0 ? `Spelade resten av säsongen (${count} matcher) ✓` : "Inga matcher kvar att spela"
  }
  if (value.startsWith("round:")) {
    const [, r, n] = value.split(":")
    const round = Number(r || 0)
    const count = Number(n || 0)
    return round ? `Omgång ${round} spelad (${count} matcher) ✓` : "Omgång spelad ✓"
  }
  return "Klart ✓"
}

type Props = { durationMs?: number }

export default function Toast({ durationMs = 6000 }: Props) {
  const search = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const msg = useMemo(() => parseDone(search.get("done")), [search])
  const [open, setOpen] = useState<boolean>(Boolean(msg))
  const [hover, setHover] = useState(false)
  const timerRef = useRef<number | null>(null)

  // när parametern ändras: öppna/stäng utan att röra URL här
  useEffect(() => {
    setOpen(Boolean(msg))
  }, [msg])

  const clearUrl = () => {
    const params = new URLSearchParams(search.toString())
    params.delete("done")
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false })
  }

  const close = () => {
    setOpen(false)
    // rensa URL strax efter för att undvika race vid render
    window.setTimeout(clearUrl, 50)
  }

  // timer med hover-paus
  useEffect(() => {
    if (!open || !msg) return
    if (timerRef.current) window.clearTimeout(timerRef.current)

    const tick = () => {
      if (hover) {
        // kolla igen om 500 ms om vi fortfarande hovrar
        timerRef.current = window.setTimeout(tick, 500)
      } else {
        close()
      }
    }

    timerRef.current = window.setTimeout(tick, durationMs)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [open, msg, hover, durationMs]) // kör om vid hover/öppen

  if (!open || !msg) return null

  return (
    <div className="fixed right-3 top-3 z-50" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div
        className="rounded-md border bg-white/95 px-3 py-2 text-sm shadow-lg backdrop-blur
                      dark:bg-zinc-900/95 dark:border-zinc-800 flex items-center gap-3"
      >
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        <span>{msg}</span>
        <button onClick={close} className="ml-2 rounded px-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Stäng">
          Stäng
        </button>
      </div>
    </div>
  )
}
