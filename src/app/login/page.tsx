"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const router = useRouter()

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Logga in</h1>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const res = await signIn("credentials", { email, name, redirect: false })
          if (res?.ok) router.push("/")
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-sm">Email</label>
          <input className="w-full rounded border px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900" value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label className="block text-sm">Namn</label>
          <input className="w-full rounded border px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900" value={name} onChange={e => setName(e.target.value)} type="text" />
        </div>
        <button className="rounded border px-3 py-1.5 text-sm dark:border-zinc-700">Logga in</button>
      </form>
    </div>
  )
}
