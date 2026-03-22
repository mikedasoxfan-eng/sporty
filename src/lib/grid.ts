import { prisma } from "./db";

/**
 * Grid category types — matches the real Immaculate Grid categories
 */
export type CategoryType =
  | { kind: "team"; teamID: string; label: string }
  | { kind: "stat"; stat: string; threshold: number; label: string }
  | { kind: "season_stat"; stat: string; threshold: number; label: string }
  | { kind: "pitching_stat"; stat: string; threshold: number; label: string }
  | { kind: "pitching_season"; stat: string; threshold: number; label: string }
  | { kind: "award"; awardID: string; label: string }
  | { kind: "allstar"; label: string }
  | { kind: "hof"; label: string }
  | { kind: "ws_champ"; label: string }
  | { kind: "born_outside_us"; label: string }
  | { kind: "position"; pos: string; label: string }
  | { kind: "war_season"; threshold: number; label: string };

// =====================================================
// Validation
// =====================================================

export async function playerMatchesCategory(
  playerID: string,
  category: CategoryType
): Promise<boolean> {
  switch (category.kind) {
    case "team": {
      const [bat, pit] = await Promise.all([
        prisma.batting.findFirst({ where: { playerID, teamID: category.teamID } }),
        prisma.pitching.findFirst({ where: { playerID, teamID: category.teamID } }),
      ]);
      return bat !== null || pit !== null;
    }

    case "stat":
      return checkCareerBattingStat(playerID, category.stat, category.threshold);

    case "season_stat":
      return checkSeasonBattingStat(playerID, category.stat, category.threshold);

    case "pitching_stat":
      return checkCareerPitchingStat(playerID, category.stat, category.threshold);

    case "pitching_season":
      return checkSeasonPitchingStat(playerID, category.stat, category.threshold);

    case "award": {
      const award = await prisma.awardsPlayers.findFirst({
        where: { playerID, awardID: category.awardID },
      });
      return award !== null;
    }

    case "allstar": {
      const entry = await prisma.allstarFull.findFirst({ where: { playerID } });
      return entry !== null;
    }

    case "hof": {
      const entry = await prisma.hallOfFame.findFirst({
        where: { playerID, inducted: "Y" },
      });
      return entry !== null;
    }

    case "ws_champ": {
      // Player's team won the World Series that year
      const batting = await prisma.batting.findMany({
        where: { playerID },
        select: { yearID: true, teamID: true },
      });
      for (const b of batting) {
        const team = await prisma.teams.findFirst({
          where: { yearID: b.yearID, teamID: b.teamID, WSWin: "Y" },
        });
        if (team) return true;
      }
      return false;
    }

    case "born_outside_us": {
      const player = await prisma.people.findUnique({
        where: { playerID },
        select: { birthCountry: true },
      });
      return player?.birthCountry != null && player.birthCountry !== "USA";
    }

    case "position": {
      // Player played this position (from Fielding or Appearances)
      const fielding = await prisma.fielding.findFirst({
        where: { playerID, POS: category.pos },
      });
      return fielding !== null;
    }

    case "war_season": {
      // Player had a season with WAR >= threshold
      const war = await prisma.playerWAR.findFirst({
        where: { playerID, WAR: { gte: category.threshold } },
      });
      return war !== null;
    }

    default:
      return false;
  }
}

async function checkCareerBattingStat(playerID: string, stat: string, threshold: number): Promise<boolean> {
  const rows = await prisma.batting.findMany({ where: { playerID } });
  if (rows.length === 0) return false;

  const career: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === "number" && key !== "id" && key !== "yearID" && key !== "stint") {
        career[key] = (career[key] || 0) + val;
      }
    }
  }

  if (stat === "AVG") {
    return (career.AB || 0) >= 2000 && (career.H || 0) / (career.AB || 1) >= threshold;
  }
  if (stat === "OPS") {
    const ab = career.AB || 0;
    if (ab < 2000) return false;
    const obp = ((career.H || 0) + (career.BB || 0) + (career.HBP || 0)) / (ab + (career.BB || 0) + (career.HBP || 0) + (career.SF || 0));
    const tb = (career.H || 0) - (career.doubles || 0) - (career.triples || 0) - (career.HR || 0) + 2 * (career.doubles || 0) + 3 * (career.triples || 0) + 4 * (career.HR || 0);
    return obp + tb / ab >= threshold;
  }

  const col = stat === "2B" ? "doubles" : stat === "3B" ? "triples" : stat;
  return (career[col] || 0) >= threshold;
}

async function checkSeasonBattingStat(playerID: string, stat: string, threshold: number): Promise<boolean> {
  const rows = await prisma.batting.findMany({ where: { playerID } });
  const byYear: Record<number, Record<string, number>> = {};
  for (const row of rows) {
    if (!byYear[row.yearID]) byYear[row.yearID] = {};
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === "number" && key !== "id" && key !== "yearID" && key !== "stint") {
        byYear[row.yearID][key] = (byYear[row.yearID][key] || 0) + val;
      }
    }
  }

  if (stat === "AVG") {
    return Object.values(byYear).some(
      (y) => (y.AB || 0) >= 100 && (y.H || 0) / (y.AB || 1) >= threshold
    );
  }

  const col = stat === "2B" ? "doubles" : stat === "3B" ? "triples" : stat;
  return Object.values(byYear).some((y) => (y[col] || 0) >= threshold);
}

async function checkCareerPitchingStat(playerID: string, stat: string, threshold: number): Promise<boolean> {
  const rows = await prisma.pitching.findMany({ where: { playerID } });
  if (rows.length === 0) return false;

  const career: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === "number" && key !== "id" && key !== "yearID" && key !== "stint") {
        career[key] = (career[key] || 0) + val;
      }
    }
  }

  if (stat === "ERA") {
    const ip = (career.IPouts || 0) / 3;
    return ip >= 1000 && ((career.ER || 0) * 9) / ip <= threshold;
  }

  return (career[stat] || 0) >= threshold;
}

async function checkSeasonPitchingStat(playerID: string, stat: string, threshold: number): Promise<boolean> {
  const rows = await prisma.pitching.findMany({ where: { playerID } });
  const byYear: Record<number, Record<string, number>> = {};
  for (const row of rows) {
    if (!byYear[row.yearID]) byYear[row.yearID] = {};
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === "number" && key !== "id" && key !== "yearID" && key !== "stint") {
        byYear[row.yearID][key] = (byYear[row.yearID][key] || 0) + val;
      }
    }
  }

  if (stat === "ERA") {
    return Object.values(byYear).some((y) => {
      const ip = (y.IPouts || 0) / 3;
      return ip >= 100 && ((y.ER || 0) * 9) / ip <= threshold;
    });
  }

  return Object.values(byYear).some((y) => (y[stat] || 0) >= threshold);
}

// =====================================================
// Categories — exact Immaculate Grid set
// =====================================================

const TEAM_POOL = [
  "NYA", "BOS", "LAN", "SFN", "CHN", "SLN", "CIN", "ATL", "PHI", "PIT",
  "CLE", "DET", "CHA", "MIN", "HOU", "BAL", "KCA", "OAK", "SEA", "TEX",
  "ANA", "NYN", "SDN", "COL", "ARI", "MIL", "TBA", "TOR", "MIA", "WAS",
];

export const TEAM_NAMES: Record<string, string> = {
  NYA: "Yankees", BOS: "Red Sox", LAN: "Dodgers", SFN: "Giants",
  CHN: "Cubs", SLN: "Cardinals", CIN: "Reds", ATL: "Braves",
  PHI: "Phillies", PIT: "Pirates", CLE: "Guardians", DET: "Tigers",
  CHA: "White Sox", MIN: "Twins", HOU: "Astros", BAL: "Orioles",
  KCA: "Royals", OAK: "Athletics", SEA: "Mariners", TEX: "Rangers",
  ANA: "Angels", NYN: "Mets", SDN: "Padres", COL: "Rockies",
  ARI: "D-backs", MIL: "Brewers", TBA: "Rays", TOR: "Blue Jays",
  MIA: "Marlins", WAS: "Nationals",
};

// The complete set of non-team categories (matching the real Immaculate Grid)
const NON_TEAM_CATEGORIES: CategoryType[] = [
  // Career batting milestones
  { kind: "stat", stat: "HR", threshold: 200, label: "200+ HR" },
  { kind: "stat", stat: "HR", threshold: 300, label: "300+ HR" },
  { kind: "stat", stat: "HR", threshold: 500, label: "500+ HR" },
  { kind: "stat", stat: "H", threshold: 2000, label: "2,000+ Hits" },
  { kind: "stat", stat: "H", threshold: 3000, label: "3,000+ Hits" },
  { kind: "stat", stat: "RBI", threshold: 1000, label: "1,000+ RBI" },
  { kind: "stat", stat: "RBI", threshold: 1500, label: "1,500+ RBI" },
  { kind: "stat", stat: "R", threshold: 1500, label: "1,500+ Runs" },
  { kind: "stat", stat: "SB", threshold: 200, label: "200+ SB" },
  { kind: "stat", stat: "SB", threshold: 300, label: "300+ SB" },
  { kind: "stat", stat: "BB", threshold: 1000, label: "1,000+ BB" },
  { kind: "stat", stat: "AVG", threshold: 0.3, label: ".300+ Career AVG" },

  // Single-season batting
  { kind: "season_stat", stat: "HR", threshold: 30, label: "30+ HR Season" },
  { kind: "season_stat", stat: "HR", threshold: 40, label: "40+ HR Season" },
  { kind: "season_stat", stat: "HR", threshold: 50, label: "50+ HR Season" },
  { kind: "season_stat", stat: "RBI", threshold: 100, label: "100+ RBI Season" },
  { kind: "season_stat", stat: "SB", threshold: 30, label: "30+ SB Season" },
  { kind: "season_stat", stat: "SB", threshold: 40, label: "40+ SB Season" },
  { kind: "season_stat", stat: "H", threshold: 200, label: "200+ Hit Season" },
  { kind: "season_stat", stat: "R", threshold: 100, label: "100+ R Season" },
  { kind: "season_stat", stat: "AVG", threshold: 0.35, label: ".350+ AVG Season" },

  // Career pitching milestones
  { kind: "pitching_stat", stat: "W", threshold: 200, label: "200+ Wins" },
  { kind: "pitching_stat", stat: "W", threshold: 300, label: "300+ Wins" },
  { kind: "pitching_stat", stat: "SO", threshold: 2000, label: "2,000+ K" },
  { kind: "pitching_stat", stat: "SO", threshold: 3000, label: "3,000+ K" },
  { kind: "pitching_stat", stat: "SV", threshold: 100, label: "100+ Saves" },
  { kind: "pitching_stat", stat: "SV", threshold: 200, label: "200+ Saves" },
  { kind: "pitching_stat", stat: "SV", threshold: 300, label: "300+ Saves" },

  // Single-season pitching
  { kind: "pitching_season", stat: "W", threshold: 20, label: "20+ Win Season" },
  { kind: "pitching_season", stat: "SO", threshold: 200, label: "200+ K Season" },
  { kind: "pitching_season", stat: "SO", threshold: 300, label: "300+ K Season" },
  { kind: "pitching_season", stat: "SV", threshold: 40, label: "40+ Save Season" },
  { kind: "pitching_season", stat: "ERA", threshold: 2.5, label: "ERA Under 2.50 Season" },

  // Awards & achievements
  { kind: "award", awardID: "Most Valuable Player", label: "MVP" },
  { kind: "award", awardID: "Cy Young Award", label: "Cy Young" },
  { kind: "award", awardID: "Rookie of the Year", label: "Rookie of the Year" },
  { kind: "award", awardID: "Gold Glove", label: "Gold Glove" },
  { kind: "award", awardID: "Silver Slugger", label: "Silver Slugger" },
  { kind: "award", awardID: "World Series MVP", label: "World Series MVP" },
  { kind: "allstar", label: "All-Star" },
  { kind: "hof", label: "Hall of Fame" },
  { kind: "ws_champ", label: "World Series Champion" },
  { kind: "born_outside_us", label: "Born Outside USA" },

  // Positions (from real Immaculate Grid: season_pos_*)
  { kind: "position", pos: "P", label: "Pitcher" },
  { kind: "position", pos: "C", label: "Catcher" },
  { kind: "position", pos: "1B", label: "First Baseman" },
  { kind: "position", pos: "2B", label: "Second Baseman" },
  { kind: "position", pos: "3B", label: "Third Baseman" },
  { kind: "position", pos: "SS", label: "Shortstop" },
  { kind: "position", pos: "OF", label: "Outfielder" },
  { kind: "position", pos: "DH", label: "Designated Hitter" },

  // WAR thresholds (from real grid: season_6_war, career_40_war)
  { kind: "war_season", threshold: 6, label: "6+ WAR Season" },
  { kind: "stat", stat: "HR", threshold: 100, label: "100+ HR" },
  { kind: "season_stat", stat: "HR", threshold: 10, label: "10+ HR Season" },
  { kind: "season_stat", stat: "AVG", threshold: 0.3, label: ".300+ AVG Season" },
  { kind: "season_stat", stat: "doubles", threshold: 40, label: "40+ Doubles Season" },
  { kind: "pitching_season", stat: "W", threshold: 10, label: "10+ Win Season" },
  { kind: "pitching_season", stat: "SV", threshold: 30, label: "30+ Save Season" },
  { kind: "pitching_stat", stat: "ERA", threshold: 3.0, label: "Career ERA Under 3.00" },
];

// =====================================================
// Grid generation with daily seed
// =====================================================

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Grid number calculation (matches the real Immaculate Grid formula):
 * gridId = floor((today - epoch) / 86400000) + 2
 * Baseball epoch: 2023-04-04, rollover: 6am ET
 */
export function getGridNumber(dateStr?: string): number {
  const epoch = new Date("2023-04-04T06:00:00-04:00").getTime();
  const now = dateStr
    ? new Date(`${dateStr}T12:00:00-04:00`).getTime()
    : Date.now();
  return Math.floor((now - epoch) / 86400000) + 2;
}

/**
 * Generate today's grid.
 *
 * Structure (matching real Immaculate Grid):
 * - 3 rows: always teams
 * - 3 columns: mix of teams (1-2) and non-team categories (1-2)
 * - No team appears in both rows and columns
 * - All 3 row teams are different, all column items are different
 *
 * The daily seed is derived from the date string (YYYY-MM-DD).
 * Same date always produces the same grid.
 */
export function generateDailyGrid(dateStr?: string): {
  rows: CategoryType[];
  cols: CategoryType[];
  gridId: string;
} {
  const today = dateStr || new Date().toISOString().slice(0, 10);
  const seed = parseInt(today.replace(/-/g, ""), 10) * 2654435761;
  const rng = seededRandom(seed);

  const shuffledTeams = shuffle(TEAM_POOL, rng);

  // 3 row teams
  const rowTeams = shuffledTeams.slice(0, 3);

  // 1-2 column teams (different from row teams)
  const colTeamCount = Math.floor(rng() * 2) + 1;
  const colTeams = shuffledTeams.slice(3, 3 + colTeamCount);

  // Fill remaining columns with non-team categories
  const nonTeamCount = 3 - colTeamCount;
  const shuffledNonTeam = shuffle(NON_TEAM_CATEGORIES, rng);
  const colNonTeam = shuffledNonTeam.slice(0, nonTeamCount);

  const rows: CategoryType[] = rowTeams.map((t) => ({
    kind: "team" as const,
    teamID: t,
    label: TEAM_NAMES[t] || t,
  }));

  const cols: CategoryType[] = shuffle(
    [
      ...colTeams.map((t) => ({
        kind: "team" as const,
        teamID: t,
        label: TEAM_NAMES[t] || t,
      })),
      ...colNonTeam,
    ],
    rng
  );

  return { rows, cols, gridId: today };
}

export function getCategoryLabel(cat: CategoryType): string {
  return cat.label;
}

export function getCategoryTeamID(cat: CategoryType): string | null {
  return cat.kind === "team" ? cat.teamID : null;
}
