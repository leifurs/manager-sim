import type { ReactNode } from "react"

export default function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm
                     dark:bg-zinc-900 dark:border-zinc-800 ${className}`}
    >
      {children}
    </div>
  )
}
