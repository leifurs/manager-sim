// prisma/seed.ts
import { PrismaClient, Position } from "@prisma/client"

const prisma = new PrismaClient()

// ---------- RNG & helpers ----------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

// ---------- Namnlistor (enkla svenska) ----------
const FIRST = ["Alexander", "Erik", "Liam", "Noah", "William", "Elias", "Leo", "Oscar", "Axel", "Viktor", "Olle", "Filip", "Isak", "Gustav", "Anton", "Lucas", "Hugo", "Arvid", "Albin", "Theo"]
const LAST = ["Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson", "Pettersson", "Jonsson", "Jansson", "Hansson", "Bengtsson", "Jönsson", "Lindberg", "Jakobsson", "Magnusson", "Olofsson"]
function makeName(rng: () => number) {
  return `${pick(FIRST, rng)} ${pick(LAST, rng)}`
}

// ---------- Data ----------
const CLUB_NAMES = ["Northbridge FC", "Riverside United", "Steelworks", "Harbor Town", "Aurora SC", "Royal Oaks", "Bluefield", "Old Mill", "Kingsport", "Red Valley"]

// ---------- Seed ----------
async function main() {
  const r = mulberry32(42)

  // Liga
  const league = await prisma.league.create({
    data: { name: "Division 1", tier: 1, country: "SE" }
  })

  // Klubbar
  const clubs = await Promise.all(
    CLUB_NAMES.map(name =>
      prisma.club.create({
        data: { name, leagueId: league.id, budget: 1500, reputation: 50 }
      })
    )
  )

  // Spelare per klubb (2 GK, 7 DF, 8 MF, 5 FW) + taktik
  for (let clubIdx = 0; clubIdx < clubs.length; clubIdx++) {
    const club = clubs[clubIdx]

    const players: Array<Parameters<typeof prisma.player.create>[0]["data"]> = []
    const dist: Record<Position, number> = {
      [Position.GK]: 2,
      [Position.DF]: 7,
      [Position.MF]: 8,
      [Position.FW]: 5
    }
    const positions: Position[] = [Position.GK, Position.DF, Position.MF, Position.FW]

    for (const pos of positions) {
      for (let i = 0; i < dist[pos]; i++) {
        // egen seed per spelare för stabila namn/attribut
        const rPlayer = mulberry32(clubIdx * 10_000 + i * 97 + pos.charCodeAt(0))
        const base = randInt(rPlayer, 50, 75)
        const ovr = base + randInt(rPlayer, -3, 3)
        const pot = Math.min(99, ovr + randInt(rPlayer, 2, 10))

        players.push({
          clubId: club.id,
          name: makeName(rPlayer), // <-- RIKTIGT NAMN
          age: randInt(rPlayer, 17, 34),
          pos,
          ovr,
          pot,
          stamina: randInt(rPlayer, 50, 90),
          pace: randInt(rPlayer, 40, 90),
          pass: randInt(rPlayer, 40, 90),
          shoot: randInt(rPlayer, 30, 90),
          defend: randInt(rPlayer, 30, 90),
          gk: pos === Position.GK ? randInt(rPlayer, 50, 90) : randInt(rPlayer, 1, 20),
          wages: randInt(rPlayer, 5, 20),
          contractUntil: 2030
        })
      }
    }

    await prisma.player.createMany({ data: players })

    // Grundtaktik
    await prisma.tactic.create({
      data: {
        clubId: club.id,
        formation: "4-3-3",
        styleJson: { tempo: 0.5, press: 0.5, line: 0.5 }
      }
    })
  }

  // Fixtures – enkel enkelmöte (circle method)
  const n = clubs.length
  const home = clubs.slice(0, Math.floor(n / 2))
  const away = clubs.slice(Math.floor(n / 2)).reverse()
  const rounds = n - 1
  const start = new Date()

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < home.length; i++) {
      const kickoff = new Date(start.getTime())
      kickoff.setDate(kickoff.getDate() + round * 7) // en omgång/vecka

      await prisma.fixture.create({
        data: {
          leagueId: league.id,
          round: round + 1,
          kickoffAt: kickoff,
          homeClubId: home[i].id,
          awayClubId: away[i].id
        }
      })
    }

    if (n > 2) {
      // rotera (förutom första i "home")
      const fixed = home[0]
      const movedFromHome = home.splice(1, 1)[0]
      const movedFromAway = away.splice(away.length - 1, 1)[0]
      home.splice(home.length, 0, movedFromAway)
      away.splice(0, 0, movedFromHome)
      home[0] = fixed
    }
  }

  console.log("✅ Seed klar (liga, klubbar, spelare med namn, taktik, fixtures)")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
