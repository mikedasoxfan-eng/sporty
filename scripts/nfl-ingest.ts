/**
 * Ingest nflverse CSV data into PostgreSQL
 *
 * Usage: npx tsx scripts/nfl-ingest.ts
 *
 * Reads downloaded CSVs from data/nfl/ and loads into:
 *   NFLTeam, NFLPlayer, NFLGame, NFLPlayerStats, NFLDraftPick, NFLStandings
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();
const NFL_DIR = path.join(__dirname, "..", "data", "nfl");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function readCSV(filename: string): Record<string, string>[] {
  const filepath = path.join(NFL_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`  Skipping ${filename} (not found)`);
    return [];
  }
  // Strip BOM if present
  const content = fs.readFileSync(filepath, "utf-8").replace(/^\uFEFF/, "");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });
}

function toInt(val: string | undefined): number | null {
  if (!val || val === "" || val === "NA") return null;
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  // Protect against INT4 overflow (Postgres max: 2,147,483,647)
  if (n > 2147483647 || n < -2147483648) return null;
  return n;
}

function toFloat(val: string | undefined): number | null {
  if (!val || val === "" || val === "NA") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toStr(val: string | undefined): string | null {
  if (!val || val === "" || val === "NA") return null;
  return val;
}

/* ------------------------------------------------------------------ */
/*  1. Teams                                                           */
/* ------------------------------------------------------------------ */

async function ingestTeams() {
  console.log("Ingesting NFL Teams...");
  const rows = readCSV("teams.csv");
  if (rows.length === 0) return;

  let count = 0;
  const batch = 100;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.nFLTeam.upsert({
          where: { teamAbbr: r.team_abbr },
          update: {
            teamName: toStr(r.team_name),
            teamNick: toStr(r.team_nick),
            teamConf: toStr(r.team_conf),
            teamDivision: toStr(r.team_division),
            teamColor: toStr(r.team_color),
            teamColor2: toStr(r.team_color2),
            teamLogo: toStr(r.team_logo_espn) || toStr(r.team_logo_wikipedia),
            teamWordmark: toStr(r.team_wordmark),
          },
          create: {
            teamAbbr: r.team_abbr,
            teamName: toStr(r.team_name),
            teamNick: toStr(r.team_nick),
            teamConf: toStr(r.team_conf),
            teamDivision: toStr(r.team_division),
            teamColor: toStr(r.team_color),
            teamColor2: toStr(r.team_color2),
            teamLogo: toStr(r.team_logo_espn) || toStr(r.team_logo_wikipedia),
            teamWordmark: toStr(r.team_wordmark),
          },
        })
      )
    );
    count += chunk.length;
  }
  console.log(`  ${count} teams ✓`);
}

/* ------------------------------------------------------------------ */
/*  2. Players                                                         */
/* ------------------------------------------------------------------ */

async function ingestPlayers() {
  console.log("Ingesting NFL Players...");
  const rows = readCSV("players.csv");
  if (rows.length === 0) return;

  // Filter rows that have a valid gsis_id
  const valid = rows.filter((r) => r.gsis_id && r.gsis_id !== "" && r.gsis_id !== "NA");

  let count = 0;
  const batch = 500;
  for (let i = 0; i < valid.length; i += batch) {
    const chunk = valid.slice(i, i + batch);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.nFLPlayer.upsert({
          where: { id: r.gsis_id },
          update: {
            displayName: toStr(r.display_name),
            firstName: toStr(r.first_name),
            lastName: toStr(r.last_name),
            suffix: toStr(r.suffix),
            position: toStr(r.position),
            positionGroup: toStr(r.position_group),
            height: toStr(r.height),
            weight: toInt(r.weight),
            birthDate: toStr(r.birth_date),
            college: toStr(r.college_name),
            collegeConf: toStr(r.college_conference),
            jerseyNumber: toInt(r.jersey_number),
            rookieSeason: toInt(r.rookie_season),
            lastSeason: toInt(r.last_season),
            latestTeam: toStr(r.latest_team),
            status: toStr(r.status),
            yearsExp: toInt(r.years_of_experience),
            headshot: toStr(r.headshot),
            draftYear: toInt(r.draft_year),
            draftRound: toInt(r.draft_round),
            draftPick: toInt(r.draft_overall || r.draft_pick),
            draftTeam: toStr(r.draft_team),
            pfrId: toStr(r.pfr_id),
            espnId: toStr(r.espn_id),
          },
          create: {
            id: r.gsis_id,
            displayName: toStr(r.display_name),
            firstName: toStr(r.first_name),
            lastName: toStr(r.last_name),
            suffix: toStr(r.suffix),
            position: toStr(r.position),
            positionGroup: toStr(r.position_group),
            height: toStr(r.height),
            weight: toInt(r.weight),
            birthDate: toStr(r.birth_date),
            college: toStr(r.college_name),
            collegeConf: toStr(r.college_conference),
            jerseyNumber: toInt(r.jersey_number),
            rookieSeason: toInt(r.rookie_season),
            lastSeason: toInt(r.last_season),
            latestTeam: toStr(r.latest_team),
            status: toStr(r.status),
            yearsExp: toInt(r.years_of_experience),
            headshot: toStr(r.headshot),
            draftYear: toInt(r.draft_year),
            draftRound: toInt(r.draft_round),
            draftPick: toInt(r.draft_overall || r.draft_pick),
            draftTeam: toStr(r.draft_team),
            pfrId: toStr(r.pfr_id),
            espnId: toStr(r.espn_id),
          },
        })
      )
    );
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${valid.length} players`);
  }
  console.log(` ✓`);
}

/* ------------------------------------------------------------------ */
/*  3. Games                                                           */
/* ------------------------------------------------------------------ */

async function ingestGames() {
  console.log("Ingesting NFL Games...");
  const rows = readCSV("games.csv");
  if (rows.length === 0) return;

  // Filter rows with a valid game_id and season
  const valid = rows.filter(
    (r) => r.game_id && r.game_id !== "" && r.season && r.season !== ""
  );

  await prisma.nFLGame.deleteMany();

  let count = 0;
  const batch = 1000;
  for (let i = 0; i < valid.length; i += batch) {
    const chunk = valid.slice(i, i + batch);
    await prisma.nFLGame.createMany({
      data: chunk.map((r) => ({
        gameId: r.game_id,
        season: toInt(r.season) || 0,
        gameType: toStr(r.game_type),
        week: toInt(r.week),
        gameday: toStr(r.gameday),
        weekday: toStr(r.weekday),
        awayTeam: toStr(r.away_team),
        awayScore: toInt(r.away_score),
        homeTeam: toStr(r.home_team),
        homeScore: toInt(r.home_score),
        result: toInt(r.result),
        overtime: toStr(r.overtime),
        awayCoach: toStr(r.away_coach),
        homeCoach: toStr(r.home_coach),
        stadium: toStr(r.stadium),
        roof: toStr(r.roof),
        surface: toStr(r.surface),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${valid.length} games`);
  }
  console.log(` ✓`);
}

/* ------------------------------------------------------------------ */
/*  4. Player Stats (aggregate weekly -> season)                       */
/* ------------------------------------------------------------------ */

interface StatsAccum {
  playerId: string;
  season: number;
  seasonType: string;
  team: string | null;
  position: string | null;
  weeks: Set<string>;
  completions: number;
  passAttempts: number;
  passYards: number;
  passTds: number;
  interceptions: number;
  sacks: number;
  sackYards: number;
  passFirstDowns: number;
  carries: number;
  rushYards: number;
  rushTds: number;
  rushFirstDowns: number;
  receptions: number;
  targets: number;
  recYards: number;
  recTds: number;
  recFirstDowns: number;
  fumbles: number;
  fumblesLost: number;
  specialTeamsTds: number;
  fantasyPoints: number;
  fantasyPointsPpr: number;
  // EPA accumulators (for averaging)
  passEpaSum: number;
  passEpaCount: number;
  rushEpaSum: number;
  rushEpaCount: number;
  recEpaSum: number;
  recEpaCount: number;
}

function newAccum(
  playerId: string,
  season: number,
  seasonType: string,
  team: string | null,
  position: string | null
): StatsAccum {
  return {
    playerId,
    season,
    seasonType,
    team,
    position,
    weeks: new Set(),
    completions: 0,
    passAttempts: 0,
    passYards: 0,
    passTds: 0,
    interceptions: 0,
    sacks: 0,
    sackYards: 0,
    passFirstDowns: 0,
    carries: 0,
    rushYards: 0,
    rushTds: 0,
    rushFirstDowns: 0,
    receptions: 0,
    targets: 0,
    recYards: 0,
    recTds: 0,
    recFirstDowns: 0,
    fumbles: 0,
    fumblesLost: 0,
    specialTeamsTds: 0,
    fantasyPoints: 0,
    fantasyPointsPpr: 0,
    passEpaSum: 0,
    passEpaCount: 0,
    rushEpaSum: 0,
    rushEpaCount: 0,
    recEpaSum: 0,
    recEpaCount: 0,
  };
}

async function ingestPlayerStats() {
  console.log("Ingesting NFL Player Stats (aggregating weekly -> season)...");
  const rows = readCSV("player_stats.csv");
  if (rows.length === 0) return;

  // Aggregate weekly rows by player + season + season_type
  const map = new Map<string, StatsAccum>();

  for (const r of rows) {
    const pid = r.player_id;
    const season = toInt(r.season);
    const seasonType = r.season_type === "POST" ? "POST" : "REG";
    if (!pid || !season) continue;

    const key = `${pid}|${season}|${seasonType}`;
    let acc = map.get(key);
    if (!acc) {
      acc = newAccum(pid, season, seasonType, toStr(r.recent_team), toStr(r.position));
      map.set(key, acc);
    }

    // Track distinct weeks for game count
    if (r.week) acc.weeks.add(r.week);

    // Update team/position to most recent
    if (toStr(r.recent_team)) acc.team = toStr(r.recent_team);
    if (toStr(r.position)) acc.position = toStr(r.position);

    // Sum counting stats
    acc.completions += toInt(r.completions) || 0;
    acc.passAttempts += toInt(r.attempts) || 0;
    acc.passYards += toInt(r.passing_yards) || 0;
    acc.passTds += toInt(r.passing_tds) || 0;
    acc.interceptions += toInt(r.interceptions) || 0;
    acc.sacks += toInt(r.sacks) || 0;
    acc.sackYards += toInt(r.sack_yards) || 0;
    acc.passFirstDowns += toInt(r.passing_first_downs) || 0;
    acc.carries += toInt(r.carries) || 0;
    acc.rushYards += toInt(r.rushing_yards) || 0;
    acc.rushTds += toInt(r.rushing_tds) || 0;
    acc.rushFirstDowns += toInt(r.rushing_first_downs) || 0;
    acc.receptions += toInt(r.receptions) || 0;
    acc.targets += toInt(r.targets) || 0;
    acc.recYards += toInt(r.receiving_yards) || 0;
    acc.recTds += toInt(r.receiving_tds) || 0;
    acc.recFirstDowns += toInt(r.receiving_first_downs) || 0;

    // Combine fumble types
    acc.fumbles +=
      (toInt(r.rushing_fumbles) || 0) +
      (toInt(r.receiving_fumbles) || 0) +
      (toInt(r.sack_fumbles) || 0);
    acc.fumblesLost +=
      (toInt(r.rushing_fumbles_lost) || 0) +
      (toInt(r.receiving_fumbles_lost) || 0) +
      (toInt(r.sack_fumbles_lost) || 0);

    acc.specialTeamsTds += toInt(r.special_teams_tds) || 0;
    acc.fantasyPoints += toFloat(r.fantasy_points) || 0;
    acc.fantasyPointsPpr += toFloat(r.fantasy_points_ppr) || 0;

    // EPA accumulators (average later)
    const pe = toFloat(r.passing_epa);
    if (pe !== null) {
      acc.passEpaSum += pe;
      acc.passEpaCount++;
    }
    const re = toFloat(r.rushing_epa);
    if (re !== null) {
      acc.rushEpaSum += re;
      acc.rushEpaCount++;
    }
    const ce = toFloat(r.receiving_epa);
    if (ce !== null) {
      acc.recEpaSum += ce;
      acc.recEpaCount++;
    }
  }

  console.log(`  Aggregated ${rows.length} weekly rows -> ${map.size} season records`);

  // Get valid player IDs to avoid FK violations
  const validPlayers = new Set(
    (await prisma.nFLPlayer.findMany({ select: { id: true } })).map((p) => p.id)
  );

  // Convert map to array and filter to valid players
  const records = Array.from(map.values()).filter((a) => validPlayers.has(a.playerId));
  console.log(`  ${records.length} records with valid player references`);

  await prisma.nFLPlayerStats.deleteMany();

  let count = 0;
  const batch = 1000;
  for (let i = 0; i < records.length; i += batch) {
    const chunk = records.slice(i, i + batch);
    await prisma.nFLPlayerStats.createMany({
      data: chunk.map((a) => ({
        playerId: a.playerId,
        season: a.season,
        seasonType: a.seasonType,
        team: a.team,
        position: a.position,
        games: a.weeks.size,
        completions: a.completions || null,
        passAttempts: a.passAttempts || null,
        passYards: a.passYards || null,
        passTds: a.passTds || null,
        interceptions: a.interceptions || null,
        sacks: a.sacks || null,
        sackYards: a.sackYards || null,
        passFirstDowns: a.passFirstDowns || null,
        passEpa: a.passEpaCount > 0 ? Math.round((a.passEpaSum / a.passEpaCount) * 1000) / 1000 : null,
        carries: a.carries || null,
        rushYards: a.rushYards || null,
        rushTds: a.rushTds || null,
        rushFirstDowns: a.rushFirstDowns || null,
        rushEpa: a.rushEpaCount > 0 ? Math.round((a.rushEpaSum / a.rushEpaCount) * 1000) / 1000 : null,
        receptions: a.receptions || null,
        targets: a.targets || null,
        recYards: a.recYards || null,
        recTds: a.recTds || null,
        recFirstDowns: a.recFirstDowns || null,
        recEpa: a.recEpaCount > 0 ? Math.round((a.recEpaSum / a.recEpaCount) * 1000) / 1000 : null,
        fumbles: a.fumbles || null,
        fumblesLost: a.fumblesLost || null,
        specialTeamsTds: a.specialTeamsTds || null,
        fantasyPoints: a.fantasyPoints ? Math.round(a.fantasyPoints * 100) / 100 : null,
        fantasyPointsPpr: a.fantasyPointsPpr ? Math.round(a.fantasyPointsPpr * 100) / 100 : null,
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${records.length} stat records`);
  }
  console.log(` ✓`);
}

/* ------------------------------------------------------------------ */
/*  5. Draft Picks                                                     */
/* ------------------------------------------------------------------ */

async function ingestDraftPicks() {
  console.log("Ingesting NFL Draft Picks...");
  const rows = readCSV("draft_picks.csv");
  if (rows.length === 0) return;

  // Filter rows with valid season/round/pick
  const valid = rows.filter(
    (r) => toInt(r.season) !== null && toInt(r.round) !== null && toInt(r.pick) !== null
  );

  await prisma.nFLDraftPick.deleteMany();

  let count = 0;
  const batch = 500;
  for (let i = 0; i < valid.length; i += batch) {
    const chunk = valid.slice(i, i + batch);
    await prisma.nFLDraftPick.createMany({
      data: chunk.map((r) => ({
        season: toInt(r.season)!,
        round: toInt(r.round)!,
        pick: toInt(r.pick)!,
        team: toStr(r.team),
        gsisId: toStr(r.gsis_id),
        pfrId: toStr(r.pfr_player_id),
        playerName: toStr(r.pfr_player_name),
        position: toStr(r.position),
        college: toStr(r.college),
        age: toInt(r.age),
        hof: toInt(r.hof),
        allpro: toInt(r.allpro),
        probowls: toInt(r.probowls),
        seasonsStarted: toInt(r.seasons_started),
        careerAV: toInt(r.car_av),
        games: toInt(r.games),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${valid.length} draft picks`);
  }
  console.log(` ✓`);
}

/* ------------------------------------------------------------------ */
/*  6. Standings                                                       */
/* ------------------------------------------------------------------ */

async function ingestStandings() {
  console.log("Ingesting NFL Standings...");
  const rows = readCSV("standings.csv");
  if (rows.length === 0) return;

  // Filter rows with valid season and team
  const valid = rows.filter(
    (r) => toInt(r.season) !== null && r.team && r.team !== ""
  );

  await prisma.nFLStandings.deleteMany();

  let count = 0;
  const batch = 500;
  for (let i = 0; i < valid.length; i += batch) {
    const chunk = valid.slice(i, i + batch);
    await prisma.nFLStandings.createMany({
      data: chunk.map((r) => ({
        season: toInt(r.season)!,
        conf: toStr(r.conf),
        division: toStr(r.division),
        team: r.team,
        wins: toInt(r.wins),
        losses: toInt(r.losses),
        ties: toInt(r.ties),
        pct: toFloat(r.pct),
        divRank: toInt(r.div_rank),
        scored: toInt(r.scored),
        allowed: toInt(r.allowed),
        seed: toInt(r.seed),
        playoff: toStr(r.playoff),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${valid.length} standings rows`);
  }
  console.log(` ✓`);
}

/* ------------------------------------------------------------------ */
/*  4b. Weekly Stats (per-game, no aggregation)                        */
/* ------------------------------------------------------------------ */

async function ingestWeeklyStats() {
  console.log("Ingesting NFL Weekly Stats (per-game rows)...");
  const rows = readCSV("player_stats.csv");
  if (rows.length === 0) return;

  // Filter rows with valid player_id, season, week
  const valid = rows.filter(
    (r) => r.player_id && r.player_id !== "" && r.player_id !== "NA" &&
           toInt(r.season) !== null && toInt(r.week) !== null
  );

  console.log(`  ${valid.length} valid weekly rows to insert`);

  await prisma.nFLWeeklyStats.deleteMany();

  let count = 0;
  const batch = 2000;
  for (let i = 0; i < valid.length; i += batch) {
    const chunk = valid.slice(i, i + batch);
    await prisma.nFLWeeklyStats.createMany({
      data: chunk.map((r) => ({
        playerId: r.player_id,
        season: toInt(r.season)!,
        week: toInt(r.week)!,
        seasonType: r.season_type === "POST" ? "POST" : "REG",
        team: toStr(r.recent_team),
        opponent: toStr(r.opponent_team),
        completions: toInt(r.completions),
        passAttempts: toInt(r.attempts),
        passYards: toInt(r.passing_yards),
        passTds: toInt(r.passing_tds),
        interceptions: toInt(r.interceptions),
        sacks: toInt(r.sacks),
        sackYards: toInt(r.sack_yards),
        carries: toInt(r.carries),
        rushYards: toInt(r.rushing_yards),
        rushTds: toInt(r.rushing_tds),
        receptions: toInt(r.receptions),
        targets: toInt(r.targets),
        recYards: toInt(r.receiving_yards),
        recTds: toInt(r.receiving_tds),
        fumbles:
          (toInt(r.rushing_fumbles) || 0) +
          (toInt(r.receiving_fumbles) || 0) +
          (toInt(r.sack_fumbles) || 0),
        fumblesLost:
          (toInt(r.rushing_fumbles_lost) || 0) +
          (toInt(r.receiving_fumbles_lost) || 0) +
          (toInt(r.sack_fumbles_lost) || 0),
        fantasyPoints: toFloat(r.fantasy_points),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${valid.length} weekly stat rows`);
  }
  console.log(` ✓`);
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  2025 season stats (from stats_player format — already aggregated)  */
/* ------------------------------------------------------------------ */
async function ingest2025Stats() {
  console.log("Ingesting 2025 season stats...");

  // Get valid player IDs
  const validPlayers = new Set(
    (await prisma.nFLPlayer.findMany({ select: { id: true } })).map((p) => p.id)
  );

  for (const [file, seasonType] of [
    ["stats_player_2025_reg.csv", "REG"],
    ["stats_player_2025_post.csv", "POST"],
  ] as const) {
    const rows = readCSV(file);
    if (rows.length === 0) continue;

    const data = rows
      .filter((r) => r.player_id && validPlayers.has(r.player_id))
      .map((r) => ({
        playerId: r.player_id,
        season: 2025,
        seasonType,
        team: toStr(r.recent_team),
        position: toStr(r.position),
        games: toInt(r.games),
        completions: toInt(r.completions),
        passAttempts: toInt(r.attempts),
        passYards: toInt(r.passing_yards),
        passTds: toInt(r.passing_tds),
        interceptions: toInt(r.passing_interceptions) || toInt(r.interceptions),
        sacks: toInt(r.sacks_suffered) || toInt(r.sacks),
        sackYards: toInt(r.sack_yards_lost) || toInt(r.sack_yards),
        passFirstDowns: toInt(r.passing_first_downs),
        passEpa: toFloat(r.passing_epa),
        carries: toInt(r.carries),
        rushYards: toInt(r.rushing_yards),
        rushTds: toInt(r.rushing_tds),
        rushFirstDowns: toInt(r.rushing_first_downs),
        rushEpa: toFloat(r.rushing_epa),
        receptions: toInt(r.receptions),
        targets: toInt(r.targets),
        recYards: toInt(r.receiving_yards),
        recTds: toInt(r.receiving_tds),
        recFirstDowns: toInt(r.receiving_first_downs),
        recEpa: toFloat(r.receiving_epa),
        fumbles: (toInt(r.rushing_fumbles) || 0) + (toInt(r.receiving_fumbles) || 0) + (toInt(r.sack_fumbles) || 0),
        fumblesLost: (toInt(r.rushing_fumbles_lost) || 0) + (toInt(r.receiving_fumbles_lost) || 0) + (toInt(r.sack_fumbles_lost) || 0),
        specialTeamsTds: toInt(r.special_teams_tds),
        fantasyPoints: toFloat(r.fantasy_points),
        fantasyPointsPpr: toFloat(r.fantasy_points_ppr),
      }));

    const batch = 500;
    for (let i = 0; i < data.length; i += batch) {
      await prisma.nFLPlayerStats.createMany({
        data: data.slice(i, i + batch),
        skipDuplicates: true,
      });
    }
    console.log(`  ${file}: ${data.length} records`);
  }
}

async function main() {
  console.log("NFL Data Pipeline - Ingest Phase");
  console.log("================================\n");

  if (!fs.existsSync(NFL_DIR)) {
    console.error(`Data directory not found: ${NFL_DIR}`);
    console.error("Run 'npm run nfl:download' first.");
    process.exit(1);
  }

  const start = Date.now();

  // Order matters: parent tables first (teams -> players -> stats)
  await ingestTeams();
  await ingestPlayers();
  await ingestGames();
  await ingestPlayerStats();
  await ingestWeeklyStats();
  await ingest2025Stats();
  await ingestDraftPicks();
  await ingestStandings();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nNFL ingest complete in ${elapsed}s!`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
