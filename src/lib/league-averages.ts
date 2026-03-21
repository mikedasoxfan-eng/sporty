/**
 * League-adjusted statistics
 *
 * Compute league averages from the Teams table and calculate
 * park-adjusted metrics like OPS+ and ERA+.
 */

import { prisma } from "./db";

export interface LeagueAverages {
  yearID: number;
  lgID: string | null;
  // Counting totals
  R: number;
  AB: number;
  H: number;
  doubles: number;
  triples: number;
  HR: number;
  BB: number;
  HBP: number;
  SF: number;
  ER: number;
  IPouts: number;
  // Computed rates
  BA: number | null;
  OBP: number | null;
  SLG: number | null;
  ERA: number | null;
}

/**
 * Compute league averages for a given year from the Teams table.
 *
 * Aggregates R, AB, H, 2B, 3B, HR, BB, HBP, SF, ER, IPouts for all teams
 * in the specified league and year, then derives BA, OBP, SLG, and ERA.
 *
 * If lgID is omitted, aggregates across all leagues for that year.
 */
export async function getLeagueAverages(
  yearID: number,
  lgID?: string
): Promise<LeagueAverages> {
  const where: Record<string, unknown> = { yearID };
  if (lgID) {
    where.lgID = lgID;
  }

  const agg = await prisma.teams.aggregate({
    where,
    _sum: {
      R: true,
      AB: true,
      H: true,
      doubles: true,
      triples: true,
      HR: true,
      BB: true,
      HBP: true,
      SF: true,
      ER: true,
      IPouts: true,
    },
  });

  const s = agg._sum;
  const R = s.R ?? 0;
  const AB = s.AB ?? 0;
  const H = s.H ?? 0;
  const doubles = s.doubles ?? 0;
  const triples = s.triples ?? 0;
  const HR = s.HR ?? 0;
  const BB = s.BB ?? 0;
  const HBP = s.HBP ?? 0;
  const SF = s.SF ?? 0;
  const ER = s.ER ?? 0;
  const IPouts = s.IPouts ?? 0;

  // Batting average
  const BA = AB > 0 ? H / AB : null;

  // On-base percentage: (H + BB + HBP) / (AB + BB + HBP + SF)
  const obpDenom = AB + BB + HBP + SF;
  const OBP = obpDenom > 0 ? (H + BB + HBP) / obpDenom : null;

  // Slugging percentage
  let SLG: number | null = null;
  if (AB > 0) {
    const singles = H - doubles - triples - HR;
    const TB = singles + 2 * doubles + 3 * triples + 4 * HR;
    SLG = TB / AB;
  }

  // ERA: (ER * 27) / IPouts
  const ERA = IPouts > 0 ? (ER * 27) / IPouts : null;

  return {
    yearID,
    lgID: lgID ?? null,
    R,
    AB,
    H,
    doubles,
    triples,
    HR,
    BB,
    HBP,
    SF,
    ER,
    IPouts,
    BA,
    OBP,
    SLG,
    ERA,
  };
}

/**
 * OPS+ = 100 * (OBP/lgOBP + SLG/lgSLG - 1), adjusted for park factor.
 *
 * The park factor (BPF) is on a 100 scale — a BPF of 105 means 5% more
 * runs than average. We divide by (BPF/100) to neutralize the park effect.
 *
 * Returns an integer (100 is league average).
 */
export function opsPlus(
  playerOBP: number,
  playerSLG: number,
  lgOBP: number,
  lgSLG: number,
  bpf: number
): number {
  if (lgOBP === 0 || lgSLG === 0 || bpf === 0) return 0;
  const parkFactor = bpf / 100;
  const adjOBP = playerOBP / parkFactor;
  const adjSLG = playerSLG / parkFactor;
  return Math.round(100 * (adjOBP / lgOBP + adjSLG / lgSLG - 1));
}

/**
 * ERA+ = 100 * (lgERA / playerERA), adjusted for park factor.
 *
 * The park factor (PPF) is on a 100 scale. A PPF of 105 means 5% more
 * runs in that park, so we adjust the player's ERA upward (divide by
 * PPF/100) to credit pitchers in hitter-friendly parks.
 *
 * Returns an integer (100 is league average; higher is better).
 */
export function eraPlus(
  playerERA: number,
  lgERA: number,
  ppf: number
): number {
  if (playerERA === 0 || ppf === 0) return 0;
  const parkFactor = ppf / 100;
  const adjERA = playerERA / parkFactor;
  return Math.round(100 * (lgERA / adjERA));
}
