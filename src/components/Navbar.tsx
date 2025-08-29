"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ThemeToggle from "@/components/ThemeToggle"
import InjuryProfileChip from "@/components/InjuryProfileChip"

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + "/")
  return (
    <Link href={href} className={`text-sm transition hover:underline ${active ? "font-semibold" : "text-zinc-700 dark:text-zinc-300"}`}>
      {children}
    </Link>
  )
}

export default function Navbar() {
  return (
    <header className="border-b bg-white dark:bg-zinc-900 dark:border-zinc-800">
      <nav className="mx-auto max-w-5xl flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-semibold">
            ManagerSim
          </Link>

          <NavLink href="/clubs">Klubbar</NavLink>
          <NavLink href="/fixtures">Matcher</NavLink>
          <NavLink href="/table">Tabell</NavLink>
          <NavLink href="/fixtures/rounds">Omgångar</NavLink>
          <NavLink href="/stats/scorers">Skytteliga</NavLink>
          <NavLink href="/stats/assists">Assistliga</NavLink>
          <NavLink href="/stats/keepers">Hållna nollor (efter nollmatcher)</NavLink>
          <NavLink href="/stats/discipline">Gula/röda kort</NavLink>
        </div>
        <ThemeToggle />
      </nav>
    </header>
  )
}
