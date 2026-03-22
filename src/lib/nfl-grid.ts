import { prisma } from "./db";

/**
 * NFL Grid category types
 */
export type NFLCategoryType =
  | { kind: "team"; teamAbbr: string; label: string }
  | { kind: "career_stat"; stat: string; threshold: number; label: string }
  | { kind: "season_stat"; stat: string; threshold: number; label: string }
  | { kind: "award"; award: string; label: string }
  | { kind: "hof"; label: string }
  | { kind: "pro_bowl"; label: string }
  | { kind: "first_round"; label: string }
  | { kind: "position"; pos: string; label: string };

// =====================================================
// Validation
// =====================================================

export async function nflPlayerMatchesCategory(
  playerId: string,
  category: NFLCategoryType
): Promise<boolean> {
  switch (category.kind) {
    case "team": {
      // Check if the player played for this team via stats or latestTeam
      const [stats, player] = await Promise.all([
        prisma.nFLPlayerStats.findFirst({
          where: { playerId, team: category.teamAbbr },
        }),
        prisma.nFLPlayer.findUnique({
          where: { id: playerId },
          select: { latestTeam: true },
        }),
      ]);
      return stats !== null || player?.latestTeam === category.teamAbbr;
    }

    case "career_stat":
      return checkNFLCareerStat(playerId, category.stat, category.threshold);

    case "season_stat":
      return checkNFLSeasonStat(playerId, category.stat, category.threshold);

    case "award": {
      // MVP check via draft_picks allpro field (or we use a simple approach)
      // For MVP we don't have a direct table, so skip or check allpro > 0
      if (category.award === "MVP") {
        // Check if player has allpro >= 1 in draft picks (proxy for MVP-caliber)
        const pick = await prisma.nFLDraftPick.findFirst({
          where: { gsisId: playerId, allpro: { gte: 1 } },
        });
        return pick !== null;
      }
      return false;
    }

    case "pro_bowl": {
      const pick = await prisma.nFLDraftPick.findFirst({
        where: { gsisId: playerId, probowls: { gte: 1 } },
      });
      return pick !== null;
    }

    case "hof": {
      const pick = await prisma.nFLDraftPick.findFirst({
        where: { gsisId: playerId, hof: 1 },
      });
      return pick !== null;
    }

    case "first_round": {
      const pick = await prisma.nFLDraftPick.findFirst({
        where: { gsisId: playerId, round: 1 },
      });
      if (pick) return true;
      // Also check NFLPlayer draftRound
      const player = await prisma.nFLPlayer.findUnique({
        where: { id: playerId },
        select: { draftRound: true },
      });
      return player?.draftRound === 1;
    }

    case "position": {
      const player = await prisma.nFLPlayer.findUnique({
        where: { id: playerId },
        select: { position: true },
      });
      return player?.position === category.pos;
    }

    default:
      return false;
  }
}

async function checkNFLCareerStat(
  playerId: string,
  stat: string,
  threshold: number
): Promise<boolean> {
  const rows = await prisma.nFLPlayerStats.findMany({
    where: { playerId, seasonType: "REG" },
  });
  if (rows.length === 0) return false;

  const career: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === "number" && key !== "id" && key !== "season") {
        career[key] = (career[key] || 0) + val;
      }
    }
  }

  return (career[stat] || 0) >= threshold;
}

async function checkNFLSeasonStat(
  playerId: string,
  stat: string,
  threshold: number
): Promise<boolean> {
  const rows = await prisma.nFLPlayerStats.findMany({
    where: { playerId, seasonType: "REG" },
  });

  return rows.some((row) => {
    const val = (row as Record<string, unknown>)[stat];
    return typeof val === "number" && val >= threshold;
  });
}

// =====================================================
// Team pool — all 32 NFL teams
// =====================================================

const NFL_TEAM_POOL = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
];

export const NFL_TEAM_NAMES: Record<string, string> = {
  ARI: "Cardinals", ATL: "Falcons", BAL: "Ravens", BUF: "Bills",
  CAR: "Panthers", CHI: "Bears", CIN: "Bengals", CLE: "Browns",
  DAL: "Cowboys", DEN: "Broncos", DET: "Lions", GB: "Packers",
  HOU: "Texans", IND: "Colts", JAX: "Jaguars", KC: "Chiefs",
  LAC: "Chargers", LAR: "Rams", LV: "Raiders", MIA: "Dolphins",
  MIN: "Vikings", NE: "Patriots", NO: "Saints", NYG: "Giants",
  NYJ: "Jets", PHI: "Eagles", PIT: "Steelers", SEA: "Seahawks",
  SF: "49ers", TB: "Buccaneers", TEN: "Titans", WAS: "Commanders",
};

// =====================================================
// Non-team categories
// =====================================================

const NFL_NON_TEAM_CATEGORIES: NFLCategoryType[] = [
  // Career passing
  { kind: "career_stat", stat: "passYards", threshold: 10000, label: "10,000+ Pass Yds" },
  { kind: "career_stat", stat: "passYards", threshold: 30000, label: "30,000+ Pass Yds" },
  { kind: "career_stat", stat: "passYards", threshold: 50000, label: "50,000+ Pass Yds" },
  { kind: "career_stat", stat: "passTds", threshold: 100, label: "100+ Pass TDs" },
  { kind: "career_stat", stat: "passTds", threshold: 200, label: "200+ Pass TDs" },

  // Career rushing
  { kind: "career_stat", stat: "rushYards", threshold: 5000, label: "5,000+ Rush Yds" },
  { kind: "career_stat", stat: "rushYards", threshold: 10000, label: "10,000+ Rush Yds" },
  { kind: "career_stat", stat: "rushTds", threshold: 50, label: "50+ Rush TDs" },

  // Career receiving
  { kind: "career_stat", stat: "recYards", threshold: 5000, label: "5,000+ Rec Yds" },
  { kind: "career_stat", stat: "recYards", threshold: 10000, label: "10,000+ Rec Yds" },
  { kind: "career_stat", stat: "recTds", threshold: 50, label: "50+ Rec TDs" },

  // Season passing
  { kind: "season_stat", stat: "passYards", threshold: 4000, label: "4,000+ Pass Yd Season" },
  { kind: "season_stat", stat: "passTds", threshold: 30, label: "30+ Pass TD Season" },

  // Season rushing
  { kind: "season_stat", stat: "rushYards", threshold: 1000, label: "1,000+ Rush Yd Season" },
  { kind: "season_stat", stat: "rushTds", threshold: 10, label: "10+ Rush TD Season" },

  // Season receiving
  { kind: "season_stat", stat: "recYards", threshold: 1000, label: "1,000+ Rec Yd Season" },
  { kind: "season_stat", stat: "recTds", threshold: 10, label: "10+ Rec TD Season" },

  // Awards
  { kind: "award", award: "MVP", label: "All-Pro" },
  { kind: "pro_bowl", label: "Pro Bowl" },
  { kind: "hof", label: "Hall of Fame" },
  { kind: "first_round", label: "1st Round Pick" },

  // Positions
  { kind: "position", pos: "QB", label: "QB" },
  { kind: "position", pos: "RB", label: "RB" },
  { kind: "position", pos: "WR", label: "WR" },
  { kind: "position", pos: "TE", label: "TE" },
  { kind: "position", pos: "K", label: "K" },
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
 * NFL Grid number — similar to baseball but with a different epoch
 * Epoch: 2024-09-05 (start of 2024 NFL season), rollover: 6am ET
 */
export function getNFLGridNumber(dateStr?: string): number {
  const epoch = new Date("2024-09-05T06:00:00-04:00").getTime();
  const now = dateStr
    ? new Date(`${dateStr}T12:00:00-04:00`).getTime()
    : Date.now();
  return Math.floor((now - epoch) / 86400000) + 1;
}

/**
 * Generate today's NFL grid.
 *
 * Structure:
 * - 3 rows: always teams
 * - 3 columns: mix of teams (1-2) and non-team categories (1-2)
 * - No team appears in both rows and columns
 */
export function generateNFLDailyGrid(dateStr?: string): {
  rows: NFLCategoryType[];
  cols: NFLCategoryType[];
  gridId: string;
} {
  const today = dateStr || new Date().toISOString().slice(0, 10);
  // Use a different multiplier than baseball to get different grids
  const seed = parseInt(today.replace(/-/g, ""), 10) * 2246822519;
  const rng = seededRandom(seed);

  const shuffledTeams = shuffle(NFL_TEAM_POOL, rng);

  // 3 row teams
  const rowTeams = shuffledTeams.slice(0, 3);

  // 1-2 column teams (different from row teams)
  const colTeamCount = Math.floor(rng() * 2) + 1;
  const colTeams = shuffledTeams.slice(3, 3 + colTeamCount);

  // Fill remaining columns with non-team categories
  const nonTeamCount = 3 - colTeamCount;
  const shuffledNonTeam = shuffle(NFL_NON_TEAM_CATEGORIES, rng);
  const colNonTeam = shuffledNonTeam.slice(0, nonTeamCount);

  const rows: NFLCategoryType[] = rowTeams.map((t) => ({
    kind: "team" as const,
    teamAbbr: t,
    label: NFL_TEAM_NAMES[t] || t,
  }));

  const cols: NFLCategoryType[] = shuffle(
    [
      ...colTeams.map((t) => ({
        kind: "team" as const,
        teamAbbr: t,
        label: NFL_TEAM_NAMES[t] || t,
      })),
      ...colNonTeam,
    ],
    rng
  );

  return { rows, cols, gridId: today };
}

export function getNFLCategoryLabel(cat: NFLCategoryType): string {
  return cat.label;
}

export function getNFLCategoryTeamAbbr(cat: NFLCategoryType): string | null {
  return cat.kind === "team" ? cat.teamAbbr : null;
}
