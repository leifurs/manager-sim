// prisma/seed.cjs
const { PrismaClient, Position } = require("@prisma/client")
const prisma = new PrismaClient()

// --- RNG helpers ---
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
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

// --- Data ---
const CLUB_NAMES = ["Northbridge FC", "Riverside United", "Steelworks", "Harbor Town", "Aurora SC", "Royal Oaks", "Bluefield", "Old Mill", "Kingsport", "Red Valley"]
const FIRST = ["Liam", "Noah", "Oliver", "Elijah", "William", "James", "Benjamin", "Lucas", "Henry", "Alexander", "Leo", "Oscar", "Hugo", "Axel", "Elias", "Arvid", "Ludvig", "Nils", "Alfred", "Viggo"]
const LAST = ["Johansson", "Andersson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson", "Pettersson", "Jonsson", "Jansson", "Hansson", "Bengtsson", "Lindberg", "Lundberg", "Lundin", "Holm", "Dahl"]

// Sub-positions (ingen TS-typ behövs i CJS)
const SUB_DIST = {
  GK: ["GK"],
  DF: ["CB", "CB", "CB", "LB", "RB"],
  MF: ["CM", "CM", "CM", "DM", "AM"],
  FW: ["ST", "ST", "LW", "RW"]
}
function pickSub(rng, main) {
  const bucket = SUB_DIST[main]
  return bucket[Math.floor(rng() * bucket.length)]
}

async function main() {
  const rng = mulberry32(42)
  const SEASON = 1

  // 1) League (kräver @@unique([name, tier, country]) i schema)
  const league = await prisma.league.upsert({
    where: { name_tier_country: { name: "Division 1", tier: 1, country: "SE" } },
    update: {},
    create: { name: "Division 1", tier: 1, country: "SE" }
  })

  // 2) Clubs + Players + Tactics
  const clubs = []
  for (const name of CLUB_NAMES) {
    const club = await prisma.club.upsert({
      where: { leagueId_name: { leagueId: league.id, name } },
      update: {},
      create: { name, leagueId: league.id, budget: 1500, reputation: 50 }
    })
    clubs.push(club)

    const hasPlayers = await prisma.player.count({ where: { clubId: club.id } })
    if (hasPlayers === 0) {
      const dist = {
        [Position.GK]: 2,
        [Position.DF]: 7,
        [Position.MF]: 8,
        [Position.FW]: 5
      }
      const players = []
      const positions = [Position.GK, Position.DF, Position.MF, Position.FW]

      for (const pos of positions) {
        for (let i = 0; i < dist[pos]; i++) {
          const base = randInt(rng, 50, 75)
          const ovr = base + randInt(rng, -3, 3)
          const pot = Math.min(99, ovr + randInt(rng, 2, 10))
          const first = pick(rng, FIRST)
          const last = pick(rng, LAST)
          const mainPos = pos // "GK"|"DF"|"MF"|"FW"
          players.push({
            clubId: club.id,
            name: `${first} ${last}`,
            age: randInt(rng, 17, 34),
            pos,
            subPos: pickSub(rng, mainPos),
            ovr,
            pot,
            stamina: randInt(rng, 50, 90),
            pace: randInt(rng, 40, 90),
            pass: randInt(rng, 40, 90),
            shoot: randInt(rng, 30, 90),
            defend: randInt(rng, 30, 90),
            gk: pos === Position.GK ? randInt(rng, 50, 90) : randInt(rng, 1, 20),
            wages: randInt(rng, 5, 20),
            contractUntil: 2030,
            fatigue: 0,
            form: 0
          })
        }
      }
      await prisma.player.createMany({ data: players })

      await prisma.tactic.upsert({
        where: { clubId: club.id },
        update: {},
        create: { clubId: club.id, formation: "4-3-3", styleJson: { tempo: 0.5, press: 0.5, line: 0.5 } }
      })
    }

    // Backfill subPos om fel (t.ex. default GK)
    const bad = await prisma.player.findMany({
      where: {
        clubId: club.id,
        OR: [
          { pos: { in: ["DF", "MF", "FW"] }, subPos: "GK" },
          { pos: "GK", NOT: { subPos: "GK" } }
        ]
      },
      select: { id: true, pos: true }
    })
    for (const p of bad) {
      const mainPos = p.pos
      await prisma.player.update({
        where: { id: p.id },
        data: { subPos: pickSub(rng, mainPos) }
      })
    }
  }

  // 3) Fixtures – season 1 (skapa bara om saknas)
  const fxCount = await prisma.fixture.count({ where: { leagueId: league.id, season: SEASON } })
  if (fxCount === 0) {
    const n = clubs.length
    const home = clubs.slice(0, Math.floor(n / 2))
    const away = clubs.slice(Math.floor(n / 2)).reverse()
    const rounds = n - 1
    const start = new Date()

    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < home.length; i++) {
        const kickoff = new Date(start.getTime())
        kickoff.setDate(kickoff.getDate() + r * 7)
        await prisma.fixture.create({
          data: {
            leagueId: league.id,
            season: SEASON,
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
  }

  console.log("Seed klar.")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
