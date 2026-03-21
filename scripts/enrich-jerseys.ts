/**
 * Fetch jersey number history from MLB Stats API rosterEntries
 *
 * Usage: npx tsx scripts/enrich-jerseys.ts
 *        npx tsx scripts/enrich-jerseys.ts --start-year 2000 --end-year 2025
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MLB_API = "https://statsapi.mlb.com/api/v1";

interface RosterEntry {
  jerseyNumber?: string;
  team?: { id: number; name: string; abbreviation: string };
  status?: { code: string };
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

interface MLBPerson {
  id: number;
  primaryNumber?: string;
  rosterEntries?: RosterEntry[];
  xrefIds?: { xrefId: string; xrefType: string }[];
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getLahmanId(person: MLBPerson): string | null {
  if (!person.xrefIds) return null;
  const lahman = person.xrefIds.find((x) => x.xrefType === "lahman");
  return lahman?.xrefId || null;
}

async function main() {
  const args = process.argv.slice(2);
  let startYear = 1876;
  let endYear = 2025;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start-year" && args[i + 1]) startYear = parseInt(args[i + 1]);
    if (args[i] === "--end-year" && args[i + 1]) endYear = parseInt(args[i + 1]);
  }

  console.log("Jersey Number Enrichment Pipeline");
  console.log("=================================");
  console.log(`Seasons: ${startYear} to ${endYear}\n`);

  // Step 1: Collect all MLB player IDs from season rosters
  const mlbPlayerIds = new Set<number>();
  for (let year = endYear; year >= startYear; year--) {
    process.stdout.write(`\rCollecting rosters... ${year} `);
    try {
      const data = (await fetchJson(
        `${MLB_API}/sports/1/players?season=${year}`
      )) as { people?: { id: number }[] };
      for (const p of data.people || []) mlbPlayerIds.add(p.id);
    } catch {
      // skip
    }
    await sleep(80);
  }
  console.log(`\nCollected ${mlbPlayerIds.size} player IDs\n`);

  // Step 2: Fetch rosterEntries + xrefId for each player in batches
  // The rosterEntries hydration only works on single-player calls
  const allIds = Array.from(mlbPlayerIds);
  let processed = 0;
  let entriesAdded = 0;
  let primaryFallbacks = 0;

  // Clear existing jersey history
  await prisma.jerseyHistory.deleteMany();

  // Process in smaller batches to get xrefId mapping first
  const batchSize = 50;
  const idToLahman = new Map<number, string>();

  console.log("Fetching Lahman ID mappings...");
  for (let i = 0; i < allIds.length; i += batchSize) {
    const batch = allIds.slice(i, i + batchSize);
    try {
      const data = (await fetchJson(
        `${MLB_API}/people?personIds=${batch.join(",")}&hydrate=xrefId`
      )) as { people?: MLBPerson[] };
      for (const p of data.people || []) {
        const lahmanId = getLahmanId(p);
        if (lahmanId) idToLahman.set(p.id, lahmanId);
      }
    } catch {
      // skip
    }
    process.stdout.write(`\r  ${Math.min(i + batchSize, allIds.length)}/${allIds.length}`);
    await sleep(100);
  }
  console.log(`\nMapped ${idToLahman.size} players to Lahman IDs\n`);

  // Now fetch rosterEntries one player at a time (the hydration requires individual calls)
  console.log("Fetching jersey histories...");
  const idsWithLahman = Array.from(idToLahman.keys());

  for (let i = 0; i < idsWithLahman.length; i++) {
    const mlbId = idsWithLahman[i];
    const lahmanId = idToLahman.get(mlbId)!;

    try {
      const data = (await fetchJson(
        `${MLB_API}/people/${mlbId}?hydrate=rosterEntries`
      )) as { people?: MLBPerson[] };

      const person = data.people?.[0];
      if (!person) continue;

      const entries = person.rosterEntries || [];
      const jerseyEntries = entries.filter(
        (e) => e.jerseyNumber && e.jerseyNumber.trim() !== ""
      );

      if (jerseyEntries.length > 0) {
        // Insert all jersey history entries
        await prisma.jerseyHistory.createMany({
          data: jerseyEntries.map((e) => ({
            playerID: lahmanId,
            jerseyNumber: e.jerseyNumber!,
            teamName: e.team?.name || null,
            teamAbbr: e.team?.abbreviation || null,
            mlbTeamID: e.team?.id || null,
            startDate: e.startDate || null,
            endDate: e.endDate || null,
            isActive: e.isActive || false,
          })),
        });
        entriesAdded += jerseyEntries.length;
      } else if (person.primaryNumber) {
        // Fallback: use primaryNumber if no rosterEntries have numbers
        await prisma.jerseyHistory.create({
          data: {
            playerID: lahmanId,
            jerseyNumber: person.primaryNumber,
            isActive: false,
          },
        });
        primaryFallbacks++;
      }

      // Also update People.uniformNumber if not already set
      const mainNumber =
        jerseyEntries.find((e) => e.isActive)?.jerseyNumber ||
        jerseyEntries[0]?.jerseyNumber ||
        person.primaryNumber;
      if (mainNumber) {
        await prisma.people.update({
          where: { playerID: lahmanId },
          data: { uniformNumber: mainNumber },
        });
      }
    } catch {
      // skip individual failures
    }

    processed++;
    if (processed % 100 === 0) {
      process.stdout.write(
        `\r  ${processed}/${idsWithLahman.length} players (${entriesAdded} entries)`
      );
    }
    // Rate limit: ~10 requests/sec
    await sleep(100);
  }

  console.log(`\n\nEnrichment complete!`);
  console.log(`  Players processed: ${processed}`);
  console.log(`  Jersey history entries: ${entriesAdded}`);
  console.log(`  Primary number fallbacks: ${primaryFallbacks}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
