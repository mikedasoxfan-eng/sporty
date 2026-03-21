/**
 * Enrich player data from the MLB Stats API
 *
 * Fetches name suffixes, nicknames, and MLB API IDs for all players
 * by iterating through seasons and cross-referencing via the xrefId hydration.
 *
 * Usage: npx tsx scripts/enrich-mlb-api.ts
 *        npx tsx scripts/enrich-mlb-api.ts --start-year 1990 --end-year 2025
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MLB_API = "https://statsapi.mlb.com/api/v1";

interface MLBPerson {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  useName?: string;
  useLastName?: string;
  nameTitle?: string;
  nameSuffix?: string;
  nickName?: string;
  fullFMLName?: string;
  middleName?: string;
  primaryNumber?: string;
  xrefIds?: { xrefId: string; xrefType: string }[];
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch all players for a given season from the MLB API
 */
async function fetchSeasonPlayers(season: number): Promise<MLBPerson[]> {
  try {
    const data = (await fetchJson(
      `${MLB_API}/sports/1/players?season=${season}`
    )) as { people?: MLBPerson[] };
    return data.people || [];
  } catch (err) {
    console.warn(`  Warning: Failed to fetch season ${season}: ${err}`);
    return [];
  }
}

/**
 * Fetch detailed player data with Lahman crosswalk IDs
 * Accepts up to ~50 IDs at once
 */
async function fetchPlayersWithXref(
  ids: number[]
): Promise<MLBPerson[]> {
  if (ids.length === 0) return [];
  try {
    const data = (await fetchJson(
      `${MLB_API}/people?personIds=${ids.join(",")}&hydrate=xrefId`
    )) as { people?: MLBPerson[] };
    return data.people || [];
  } catch (err) {
    console.warn(`  Warning: Failed to fetch player details: ${err}`);
    return [];
  }
}

/**
 * Extract Lahman playerID from xrefIds array
 */
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

  console.log("MLB Stats API Enrichment Pipeline");
  console.log("==================================");
  console.log(`Seasons: ${startYear} to ${endYear}\n`);

  // Collect all unique MLB player IDs across seasons
  const mlbPlayerIds = new Set<number>();
  const playerSeasonMap = new Map<number, MLBPerson>();

  for (let year = endYear; year >= startYear; year--) {
    process.stdout.write(`\rFetching season rosters... ${year} `);
    const players = await fetchSeasonPlayers(year);

    for (const p of players) {
      if (!playerSeasonMap.has(p.id)) {
        playerSeasonMap.set(p.id, p);
      }
      mlbPlayerIds.add(p.id);
    }

    // Rate limiting — be respectful
    await sleep(100);
  }

  console.log(`\n\nCollected ${mlbPlayerIds.size} unique MLB player IDs`);

  // Fetch detailed data with Lahman crosswalk in batches
  const allIds = Array.from(mlbPlayerIds);
  const batchSize = 50;
  let enriched = 0;
  let suffixCount = 0;
  let nicknameCount = 0;
  let noLahmanId = 0;

  console.log(`\nFetching player details + Lahman crosswalk...`);

  for (let i = 0; i < allIds.length; i += batchSize) {
    const batch = allIds.slice(i, i + batchSize);
    const details = await fetchPlayersWithXref(batch);

    for (const person of details) {
      const lahmanId = getLahmanId(person);

      if (!lahmanId) {
        noLahmanId++;
        continue;
      }

      // Build the update payload — only set fields that have values
      const update: Record<string, unknown> = {
        mlbamID: person.id,
      };

      if (person.nameSuffix) {
        update.nameSuffix = person.nameSuffix;
        suffixCount++;
      }

      if (person.nickName) {
        update.nickName = person.nickName;
        nicknameCount++;
      }

      if (person.primaryNumber) {
        update.uniformNumber = person.primaryNumber;
      }

      // Also fix nameFirst/nameLast from MLB API if they differ
      // The MLB API has more accurate names with proper suffixes
      if (person.useName) {
        update.nameFirst = person.useName;
      }
      if (person.useLastName) {
        update.nameLast = person.useLastName;
      }

      try {
        await prisma.people.update({
          where: { playerID: lahmanId },
          data: update,
        });
        enriched++;
      } catch {
        // Player not in our DB — skip
      }
    }

    process.stdout.write(
      `\r  ${Math.min(i + batchSize, allIds.length)}/${allIds.length} players processed`
    );

    // Rate limiting
    await sleep(150);
  }

  console.log(`\n\nEnrichment complete!`);
  console.log(`  Players enriched: ${enriched}`);
  console.log(`  Suffixes added: ${suffixCount} (Jr., Sr., II, III, IV)`);
  console.log(`  Nicknames added: ${nicknameCount}`);
  console.log(`  No Lahman crosswalk: ${noLahmanId}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
