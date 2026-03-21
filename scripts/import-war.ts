/**
 * Import WAR data from Baseball-Reference bulk CSV files
 *
 * Downloads batting and pitching WAR data, cross-references with
 * People.bbrefID to resolve playerIDs, and upserts into PlayerWAR.
 *
 * Usage: npx tsx scripts/import-war.ts
 *        npx tsx scripts/import-war.ts --batting-only
 *        npx tsx scripts/import-war.ts --pitching-only
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATTING_WAR_URL =
  "https://www.baseball-reference.com/data/war_daily_bat.txt";
const PITCHING_WAR_URL =
  "https://www.baseball-reference.com/data/war_daily_pitch.txt";

const BATCH_SIZE = 500;

interface BattingWARRow {
  name_common: string;
  age: string;
  player_ID: string;
  team_ID: string;
  stint_ID: string;
  lg_ID: string;
  year_ID: string;
  WAR: string;
  WAR_off: string;
  WAR_def: string;
  WAR_rep: string;
}

interface PitchingWARRow {
  name_common: string;
  age: string;
  player_ID: string;
  team_ID: string;
  stint_ID: string;
  lg_ID: string;
  year_ID: string;
  WAR: string;
}

// Aggregated WAR record for a player-year
interface WARRecord {
  playerID: string;
  yearID: number;
  teamID: string | null;
  lgID: string | null;
  WAR: number;
  oWAR: number;
  dWAR: number;
}

async function fetchCSV(url: string): Promise<string> {
  console.log(`  Downloading ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function safeFloat(val: string | undefined): number {
  if (!val || val === "" || val === "NULL" || val === "NA") return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function safeInt(val: string | undefined): number {
  if (!val || val === "" || val === "NULL" || val === "NA") return 0;
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Build a lookup map from bbrefID -> playerID using the People table
 */
async function buildBbrefLookup(): Promise<Map<string, string>> {
  console.log("  Building bbrefID -> playerID lookup from People table...");
  const people = await prisma.people.findMany({
    where: { bbrefID: { not: null } },
    select: { playerID: true, bbrefID: true },
  });

  const lookup = new Map<string, string>();
  for (const p of people) {
    if (p.bbrefID) {
      lookup.set(p.bbrefID, p.playerID);
    }
  }

  console.log(`  Found ${lookup.size} players with bbrefIDs\n`);
  return lookup;
}

/**
 * Process batting WAR data into per-player-year records
 * Uses the first stint's team/league as the representative values
 */
function aggregateBattingWAR(
  rows: Record<string, string>[],
  bbrefLookup: Map<string, string>
): Map<string, WARRecord> {
  const records = new Map<string, WARRecord>();
  let skipped = 0;

  for (const row of rows) {
    const bbrefID = row["player_ID"];
    const playerID = bbrefLookup.get(bbrefID);
    if (!playerID) {
      skipped++;
      continue;
    }

    const yearID = safeInt(row["year_ID"]);
    if (yearID === 0) continue;

    const key = `${playerID}:${yearID}`;
    const war = safeFloat(row["WAR"]);
    const oWAR = safeFloat(row["WAR_off"]);
    const dWAR = safeFloat(row["WAR_def"]);

    const existing = records.get(key);
    if (existing) {
      // Sum across stints for the same player-year
      existing.WAR += war;
      existing.oWAR += oWAR;
      existing.dWAR += dWAR;
    } else {
      records.set(key, {
        playerID,
        yearID,
        teamID: row["team_ID"] || null,
        lgID: row["lg_ID"] || null,
        WAR: war,
        oWAR,
        dWAR,
      });
    }
  }

  console.log(
    `  Batting WAR: ${records.size} player-years, ${skipped} rows skipped (no bbrefID match)`
  );
  return records;
}

/**
 * Process pitching WAR data and merge into existing records
 * Pitching WAR is added to any existing batting WAR for the same player-year
 */
function aggregatePitchingWAR(
  rows: Record<string, string>[],
  bbrefLookup: Map<string, string>,
  records: Map<string, WARRecord>
): Map<string, WARRecord> {
  let merged = 0;
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const bbrefID = row["player_ID"];
    const playerID = bbrefLookup.get(bbrefID);
    if (!playerID) {
      skipped++;
      continue;
    }

    const yearID = safeInt(row["year_ID"]);
    if (yearID === 0) continue;

    const key = `${playerID}:${yearID}`;
    const war = safeFloat(row["WAR"]);

    const existing = records.get(key);
    if (existing) {
      // Player has both batting and pitching WAR — sum them
      existing.WAR += war;
      merged++;
    } else {
      // Pitcher-only: WAR goes to total WAR, no oWAR/dWAR split
      records.set(key, {
        playerID,
        yearID,
        teamID: row["team_ID"] || null,
        lgID: row["lg_ID"] || null,
        WAR: war,
        oWAR: 0,
        dWAR: 0,
      });
      created++;
    }
  }

  console.log(
    `  Pitching WAR: ${created} pitcher-only player-years, ${merged} merged with batting, ${skipped} skipped`
  );
  return records;
}

/**
 * Upsert WAR records into the database in batches
 */
async function upsertRecords(records: Map<string, WARRecord>): Promise<void> {
  const all = Array.from(records.values());
  let upserted = 0;
  let errors = 0;

  console.log(`\nUpserting ${all.length} WAR records in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((rec) =>
        prisma.playerWAR.upsert({
          where: {
            playerID_yearID: {
              playerID: rec.playerID,
              yearID: rec.yearID,
            },
          },
          update: {
            teamID: rec.teamID,
            lgID: rec.lgID,
            WAR: Math.round(rec.WAR * 10) / 10,
            oWAR: Math.round(rec.oWAR * 10) / 10,
            dWAR: Math.round(rec.dWAR * 10) / 10,
          },
          create: {
            playerID: rec.playerID,
            yearID: rec.yearID,
            teamID: rec.teamID,
            lgID: rec.lgID,
            WAR: Math.round(rec.WAR * 10) / 10,
            oWAR: Math.round(rec.oWAR * 10) / 10,
            dWAR: Math.round(rec.dWAR * 10) / 10,
          },
        })
      )
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        upserted++;
      } else {
        errors++;
      }
    }

    process.stdout.write(
      `\r  ${Math.min(i + BATCH_SIZE, all.length)}/${all.length} records processed`
    );
  }

  console.log(`\n  Upserted: ${upserted}, Errors: ${errors}`);
}

async function main() {
  const args = process.argv.slice(2);
  const battingOnly = args.includes("--batting-only");
  const pitchingOnly = args.includes("--pitching-only");

  console.log("Baseball-Reference WAR Import");
  console.log("=============================\n");

  // Build the bbrefID -> playerID lookup
  const bbrefLookup = await buildBbrefLookup();

  let records = new Map<string, WARRecord>();

  // Download and process batting WAR
  if (!pitchingOnly) {
    console.log("Step 1: Batting WAR");
    const battingCSV = await fetchCSV(BATTING_WAR_URL);
    const battingRows = parseCSV(battingCSV);
    console.log(`  Parsed ${battingRows.length} batting WAR rows`);
    records = aggregateBattingWAR(battingRows, bbrefLookup);
  }

  // Download and process pitching WAR
  if (!battingOnly) {
    console.log("\nStep 2: Pitching WAR");
    const pitchingCSV = await fetchCSV(PITCHING_WAR_URL);
    const pitchingRows = parseCSV(pitchingCSV);
    console.log(`  Parsed ${pitchingRows.length} pitching WAR rows`);
    records = aggregatePitchingWAR(pitchingRows, bbrefLookup, records);
  }

  // Upsert all records
  console.log(`\nStep 3: Database Upsert`);
  console.log(`  Total unique player-years: ${records.size}`);
  await upsertRecords(records);

  // Summary
  const warValues = Array.from(records.values()).map((r) => r.WAR);
  const maxWAR = Math.max(...warValues);
  const minWAR = Math.min(...warValues);
  const years = new Set(Array.from(records.values()).map((r) => r.yearID));

  console.log(`\nImport complete!`);
  console.log(`  Seasons covered: ${Math.min(...years)} - ${Math.max(...years)}`);
  console.log(`  WAR range: ${minWAR.toFixed(1)} to ${maxWAR.toFixed(1)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
