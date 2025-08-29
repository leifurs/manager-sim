// src/components/SubmitButton.tsx
"use client"

import { useFormStatus } from "react-dom"
import Spinner from "./Spinner"

type Props = {
  children: React.ReactNode
  pendingText?: string
  size?: "sm" | "md"
  className?: string
}

export default function SubmitButton({ children, pendingText = "Arbetar…", size = "md", className = "" }: Props) {
  const { pending } = useFormStatus()
  const base = "inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm"
  const tone = "bg-black text-white dark:bg-white dark:text-black border-transparent"
  const small = size === "sm" ? "px-2 py-1 text-xs" : ""
  return (
    <button type="submit" className={`${base} ${tone} ${small} ${className}`} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <Spinner className={size === "sm" ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2"} />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  )
}
