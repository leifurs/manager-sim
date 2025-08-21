"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme() // 👈 använd resolvedTheme
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null // undvik hydration-flash

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-lg border px-3 py-1.5 text-sm transition
                 bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-800
                 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
      aria-label="Växla tema"
    >
      {isDark ? "☀️ Ljust" : "🌙 Mörkt"}
    </button>
  )
}
