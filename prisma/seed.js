// prisma/seed.js
const { PrismaClient, Position } = require("@prisma/client")
const prisma = new PrismaClient()

// Mulberry32 – enkel deterministisk RNG
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min
}

const CLUB_NAMES = ["Northbridge FC", "Riverside United", "Steelworks", "Harbor Town", "Aurora SC", "Royal Oaks", "Bluefield", "Old Mill", "Kingsport", "Red Valley"]

async function main() {
  const rng = mulberry32(42)

  // Skapa liga
  const league = await prisma.league.create({
    data: { name: "Division 1", tier: 1, country: "SE" }
  })

  // Skapa klubbar
  const clubs = await Promise.all(
    CLUB_NAMES.map(name =>
      prisma.club.create({
        data: { name, leagueId: league.id, budget: 1500, reputation: 50 }
      })
    )
  )

  // Spelare per klubb (2 GK, 7 DF, 8 MF, 5 FW)
  for (const club of clubs) {
    const players = []
    const dist = {
      [Position.GK]: 2,
      [Position.DF]: 7,
      [Position.MF]: 8,
      [Position.FW]: 5
    }

    const positions = [Position.GK, Position.DF, Position.MF, Position.FW]

    for (const pos of positions) {
      for (let i = 0; i < dist[pos]; i++) {
        const base = randInt(rng, 50, 75)
        const ovr = base + randInt(rng, -3, 3)
        const pot = Math.min(99, ovr + randInt(rng, 2, 10))
        players.push({
          clubId: club.id,
          age: randInt(rng, 17, 34),
          pos,
          ovr,
          pot,
          stamina: randInt(rng, 50, 90),
          pace: randInt(rng, 40, 90),
          pass: randInt(rng, 40, 90),
          shoot: randInt(rng, 30, 90),
          defend: randInt(rng, 30, 90),
          gk: pos === Position.GK ? randInt(rng, 50, 90) : randInt(rng, 1, 20),
          wages: randInt(rng, 5, 20),
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

  // Fixtures: enkel möte (circle method)
  const n = clubs.length
  const home = clubs.slice(0, Math.floor(n / 2))
  const away = clubs.slice(Math.floor(n / 2)).reverse()
  const rounds = n - 1
  const start = new Date()

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < home.length; i++) {
      const kickoff = new Date(start.getTime())
      kickoff.setDate(kickoff.getDate() + r * 7) // en omgång/vecka
      await prisma.fixture.create({
        data: {
          leagueId: league.id,
          round: r + 1,
          kickoffAt: kickoff,
          homeClubId: home[i].id,
          awayClubId: away[i].id
        }
      })
    }
    if (n > 2) {
      const fixed = home[0]
      const movedFromHome = home.splice(1, 1)[0]
      const movedFromAway = away.splice(away.length - 1, 1)[0]
      home.splice(home.length, 0, movedFromAway)
      away.splice(0, 0, movedFromHome)
      home[0] = fixed
    }
  }

  console.log("Seed klar")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
