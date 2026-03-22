/**
 * Fetch awards for 2017-2025 from MLB Stats API using the correct endpoints
 *
 * Usage: npx tsx scripts/enrich-awards.ts [startYear] [endYear]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MLB_API = "https://statsapi.mlb.com/api/v1";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Award IDs and their Lahman mapping
const AWARDS = [
  { mlbId: "ALMVP", lahman: "Most Valuable Player", lg: "AL" },
  { mlbId: "NLMVP", lahman: "Most Valuable Player", lg: "NL" },
  { mlbId: "ALCY", lahman: "Cy Young Award", lg: "AL" },
  { mlbId: "NLCY", lahman: "Cy Young Award", lg: "NL" },
  { mlbId: "ALROY", lahman: "Rookie of the Year", lg: "AL" },
  { mlbId: "NLROY", lahman: "Rookie of the Year", lg: "NL" },
  { mlbId: "ALGG", lahman: "Gold Glove", lg: "AL" },
  { mlbId: "NLGG", lahman: "Gold Glove", lg: "NL" },
  { mlbId: "ALSS", lahman: "Silver Slugger", lg: "AL" },
  { mlbId: "NLSS", lahman: "Silver Slugger", lg: "NL" },
  { mlbId: "WSMVP", lahman: "World Series MVP", lg: "" },
  { mlbId: "ASMVP", lahman: "All-Star Game MVP", lg: "" },
  { mlbId: "ALCSMVP", lahman: "ALCS Most Valuable Player", lg: "AL" },
  { mlbId: "NLCSMVP", lahman: "NLCS Most Valuable Player", lg: "NL" },
];

async function main() {
  const startYear = parseInt(process.argv[2] || "2017");
  const endYear = parseInt(process.argv[3] || "2025");

  console.log("Awards Enrichment from MLB Stats API");
  console.log(`Seasons: ${startYear}-${endYear}\n`);

  // Build mlbamID -> lahmanID lookup
  const people = await prisma.people.findMany({
    where: { mlbamID: { not: null } },
    select: { playerID: true, mlbamID: true },
  });
  const idMap = new Map<number, string>();
  for (const p of people) {
    if (p.mlbamID) idMap.set(p.mlbamID, p.playerID);
  }
  console.log(`ID map: ${idMap.size} players\n`);

  let awardsAdded = 0;

  for (let year = startYear; year <= endYear; year++) {
    process.stdout.write(`${year}: `);
    let yearCount = 0;

    for (const award of AWARDS) {
      const data = (await fetchJson(
        `${MLB_API}/awards/${award.mlbId}/recipients?season=${year}`
      )) as { awards?: { player?: { id: number }; season: string }[] } | null;

      if (!data?.awards) continue;

      for (const entry of data.awards) {
        if (!entry.player?.id) continue;
        const lahmanId = idMap.get(entry.player.id);
        if (!lahmanId) continue;

        try {
          await prisma.awardsPlayers.upsert({
            where: {
              playerID_awardID_yearID_lgID: {
                playerID: lahmanId,
                awardID: award.lahman,
                yearID: year,
                lgID: award.lg,
              },
            },
            update: {},
            create: {
              playerID: lahmanId,
              awardID: award.lahman,
              yearID: year,
              lgID: award.lg,
            },
          });
          yearCount++;
          awardsAdded++;
        } catch {
          // skip
        }
      }

      await sleep(50);
    }

    console.log(`${yearCount} awards`);
  }

  // Also fix All-Star duplicates — deduplicate by playerID+yearID
  console.log("\nDeduplicating All-Star entries...");
  const allstar = await prisma.allstarFull.findMany({
    select: { id: true, playerID: true, yearID: true },
    orderBy: [{ playerID: "asc" }, { yearID: "asc" }, { id: "asc" }],
  });

  const seen = new Set<string>();
  let deleted = 0;
  for (const entry of allstar) {
    const key = `${entry.playerID}-${entry.yearID}`;
    if (seen.has(key)) {
      await prisma.allstarFull.delete({ where: { id: entry.id } });
      deleted++;
    } else {
      seen.add(key);
    }
  }
  console.log(`Deleted ${deleted} duplicate All-Star entries`);

  console.log(`\nDone! ${awardsAdded} awards added.`);
  await prisma.$disconnect();
}

main().catch(console.error);
