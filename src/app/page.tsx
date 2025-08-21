import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "ManagerSim – Fotbollsmanagerspel i Next.js",
  description: "Bygg och utveckla din egen fotbollsklubb i ManagerSim, ett modernt managerspel byggt med Next.js och Prisma."
}

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Välkommen till ManagerSim</h1>
      <p className="text-gray-700">ManagerSim är ett fotbollsmanagerspel under utveckling. Här kan du bygga din klubb, utveckla spelare och tävla i ligor.</p>

      <div className="flex gap-4">
        <Link href="/clubs" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Utforska klubbar
        </Link>
      </div>
    </div>
  )
}
