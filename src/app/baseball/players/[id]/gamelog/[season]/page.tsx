import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtAvg, fmtEra, fullName } from "@/lib/format";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  MLB team ID -> abbreviation mapping                                */
/* ------------------------------------------------------------------ */
const MLB_TEAM_ABBR: Record<number, string> = {
  108:"LAA",109:"ARI",110:"BAL",111:"BOS",112:"CHC",113:"CIN",114:"CLE",
  115:"COL",116:"DET",117:"HOU",118:"KC",119:"LAD",120:"WSH",121:"NYM",
  133:"OAK",134:"PIT",135:"SD",136:"SEA",137:"SF",138:"STL",139:"TB",
  140:"TEX",141:"TOR",142:"MIN",143:"PHI",144:"ATL",145:"CWS",146:"MIA",
  147:"NYY",158:"MIL",
};

/* ------------------------------------------------------------------ */
/*  Style constants (matching player page)                             */
/* ------------------------------------------------------------------ */
const TH_LEFT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left";
const TH_RIGHT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-right";
const TD_LEFT = "py-2 px-2.5 text-left text-xs";
const TD_RIGHT = "py-2 px-2.5 text-right font-mono text-xs";
const TD_RIGHT_BOLD = "py-2 px-2.5 text-right font-mono text-xs font-medium";
const LINK_CLASSES =
  "text-link hover:text-link-hover hover:underline transition-colors";
const STICKY_TH =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left sticky left-0 z-20 bg-surface";
const STICKY_TD =
  "py-2 px-2.5 text-left text-xs font-medium sticky left-0 z-10 bg-surface whitespace-nowrap";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  params: Promise<{ id: string; season: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Split = any;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatGameDate(dateStr: string): string {
  // dateStr comes as "2024-04-01" or similar
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildResultString(split: Split): string {
  const game = split.game;
  if (!game) return "";
  const isHome = split.isHome;
  const opponent = split.opponent?.name || "";
  // Shorten team name: "Oakland Athletics" -> "OAK", "Los Angeles Dodgers" -> "LAD"
  const oppShort = MLB_TEAM_ABBR[split.opponent?.id] || opponent.split(" ").pop() || "";
  const prefix = isHome ? "vs" : "@";
  const wl = split.isWin ? "W" : "L";
  return `${wl} ${prefix} ${oppShort}`;
}

/* ------------------------------------------------------------------ */
/*  Data fetching                                                      */
/* ------------------------------------------------------------------ */
async function getPlayer(id: string) {
  return prisma.people.findUnique({
    where: { playerID: id },
    select: {
      playerID: true,
      nameFirst: true,
      nameLast: true,
      nameGiven: true,
      nameSuffix: true,
      mlbamID: true,
    },
  });
}

async function fetchGameLog(
  mlbamID: number,
  season: string,
  group: "hitting" | "pitching"
): Promise<Split[]> {
  const url = `https://statsapi.mlb.com/api/v1/people/${mlbamID}/stats?stats=gameLog&season=${season}&group=${group}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.stats?.[0]?.splits ?? [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Batting helpers                                                    */
/* ------------------------------------------------------------------ */
interface BattingTotals {
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  sb: number;
  games: number;
}

function accumulateBattingTotals(splits: Split[]): BattingTotals {
  return splits.reduce(
    (acc: BattingTotals, s: Split) => ({
      ab: acc.ab + (s.stat?.atBats || 0),
      r: acc.r + (s.stat?.runs || 0),
      h: acc.h + (s.stat?.hits || 0),
      doubles: acc.doubles + (s.stat?.doubles || 0),
      triples: acc.triples + (s.stat?.triples || 0),
      hr: acc.hr + (s.stat?.homeRuns || 0),
      rbi: acc.rbi + (s.stat?.rbi || 0),
      bb: acc.bb + (s.stat?.baseOnBalls || 0),
      so: acc.so + (s.stat?.strikeOuts || 0),
      sb: acc.sb + (s.stat?.stolenBases || 0),
      games: acc.games + 1,
    }),
    { ab: 0, r: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, bb: 0, so: 0, sb: 0, games: 0 }
  );
}

function computeBattingAvg(totals: BattingTotals): number | null {
  if (totals.ab === 0) return null;
  return totals.h / totals.ab;
}

function computeOBP(totals: BattingTotals): number | null {
  const denom = totals.ab + totals.bb;
  if (denom === 0) return null;
  return (totals.h + totals.bb) / denom;
}

function computeSLG(totals: BattingTotals): number | null {
  if (totals.ab === 0) return null;
  const singles = totals.h - totals.doubles - totals.triples - totals.hr;
  const tb = singles + 2 * totals.doubles + 3 * totals.triples + 4 * totals.hr;
  return tb / totals.ab;
}

/* ------------------------------------------------------------------ */
/*  Pitching helpers                                                   */
/* ------------------------------------------------------------------ */
interface PitchingTotals {
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  games: number;
}

function parseIP(ipStr: string | undefined): number {
  if (!ipStr) return 0;
  const val = parseFloat(ipStr);
  if (isNaN(val)) return 0;
  return val;
}

function addIP(a: number, b: number): number {
  // Innings are decimal (e.g., 6.2 = 6 and 2/3)
  // Convert to thirds, add, convert back
  const aFull = Math.floor(a);
  const aPartial = Math.round((a - aFull) * 10);
  const bFull = Math.floor(b);
  const bPartial = Math.round((b - bFull) * 10);
  const totalThirds = aFull * 3 + aPartial + bFull * 3 + bPartial;
  const fullInnings = Math.floor(totalThirds / 3);
  const remainderThirds = totalThirds % 3;
  return fullInnings + remainderThirds / 10;
}

function formatIPTotal(ip: number): string {
  const full = Math.floor(ip);
  const partial = Math.round((ip - full) * 10);
  return `${full}.${partial}`;
}

function accumulatePitchingTotals(splits: Split[]): PitchingTotals {
  let totalIP = 0;
  let h = 0, r = 0, er = 0, bb = 0, so = 0, hr = 0;
  for (const s of splits) {
    totalIP = addIP(totalIP, parseIP(s.stat?.inningsPitched));
    h += s.stat?.hits || 0;
    r += s.stat?.runs || 0;
    er += s.stat?.earnedRuns || 0;
    bb += s.stat?.baseOnBalls || 0;
    so += s.stat?.strikeOuts || 0;
    hr += s.stat?.homeRuns || 0;
  }
  return { ip: totalIP, h, r, er, bb, so, hr, games: splits.length };
}

function computeERA(totals: PitchingTotals): number | null {
  const full = Math.floor(totals.ip);
  const partial = Math.round((totals.ip - full) * 10);
  const ipInThirds = full * 3 + partial;
  if (ipInThirds === 0) return null;
  return (totals.er * 27) / ipInThirds;
}

function getDecision(split: Split): string {
  const stat = split.stat;
  if (!stat) return "";
  if (stat.wins === 1) return "W";
  if (stat.losses === 1) return "L";
  if (stat.saves === 1) return "S";
  if (stat.holds === 1) return "H";
  if (stat.blownSaves === 1) return "BS";
  return "";
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, season } = await params;
  const player = await getPlayer(id);
  if (!player) return { title: "Player Not Found" };
  const name = fullName(player.nameFirst, player.nameLast, player.nameGiven, player.nameSuffix);
  return { title: `${name} ${season} Game Log` };
}

/* ------------------------------------------------------------------ */
/*  Batting table                                                      */
/* ------------------------------------------------------------------ */
function BattingGameLog({ splits, season }: { splits: Split[]; season: string }) {
  if (splits.length === 0) return null;

  // Group by month
  const monthGroups: { month: string; splits: Split[] }[] = [];
  let currentMonth = "";
  for (const split of splits) {
    const month = getMonthKey(split.date);
    if (month !== currentMonth) {
      monthGroups.push({ month, splits: [] });
      currentMonth = month;
    }
    monthGroups[monthGroups.length - 1].splits.push(split);
  }

  const seasonTotals = accumulateBattingTotals(splits);
  const seasonAvg = computeBattingAvg(seasonTotals);
  const seasonOBP = computeOBP(seasonTotals);
  const seasonSLG = computeSLG(seasonTotals);
  const seasonOPS = seasonOBP != null && seasonSLG != null ? seasonOBP + seasonSLG : null;

  const battingCols = [
    "Date", "Opp", "Result", "AB", "R", "H", "2B", "3B", "HR",
    "RBI", "BB", "SO", "SB", "BA", "OBP", "SLG", "OPS",
  ];

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold">{season} Batting Game Log</h2>
      </div>
      <div className="stat-scroll overflow-x-auto">
        <table className="stat-table w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {battingCols.map((col, i) => (
                <th key={col} className={i < 3 ? (i === 0 ? STICKY_TH : TH_LEFT) : TH_RIGHT}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {monthGroups.map((group) => {
              const monthTotals = accumulateBattingTotals(group.splits);
              const monthAvg = computeBattingAvg(monthTotals);
              const monthOBP = computeOBP(monthTotals);
              const monthSLG = computeSLG(monthTotals);
              const monthOPS = monthOBP != null && monthSLG != null ? monthOBP + monthSLG : null;

              return [
                ...group.splits.map((split: Split, idx: number) => {
                  const stat = split.stat || {};
                  const opponent = MLB_TEAM_ABBR[split.opponent?.id] || split.opponent?.name?.split(" ").pop() || "";
                  const isHome = split.isHome;
                  const prefix = isHome ? "vs" : "@";
                  const result = buildResultString(split);

                  return (
                    <tr key={`${split.date}-${idx}`} className="hover:bg-surface-alt/50">
                      <td className={STICKY_TD}>{formatGameDate(split.date)}</td>
                      <td className={TD_LEFT}>
                        <span className="text-muted-light">{prefix}</span>{" "}
                        {opponent}
                      </td>
                      <td className={`${TD_LEFT} ${split.isWin ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                        {result}
                      </td>
                      <td className={TD_RIGHT}>{stat.atBats ?? 0}</td>
                      <td className={TD_RIGHT}>{stat.runs ?? 0}</td>
                      <td className={TD_RIGHT_BOLD}>{stat.hits ?? 0}</td>
                      <td className={TD_RIGHT}>{stat.doubles ?? 0}</td>
                      <td className={TD_RIGHT}>{stat.triples ?? 0}</td>
                      <td className={stat.homeRuns > 0 ? TD_RIGHT_BOLD : TD_RIGHT}>
                        {stat.homeRuns ?? 0}
                      </td>
                      <td className={TD_RIGHT}>{stat.rbi ?? 0}</td>
                      <td className={TD_RIGHT}>{stat.baseOnBalls ?? 0}</td>
                      <td className={TD_RIGHT}>{stat.strikeOuts ?? 0}</td>
                      <td className={TD_RIGHT}>{stat.stolenBases ?? 0}</td>
                      <td className={TD_RIGHT}>{fmtAvg(stat.avg != null ? parseFloat(stat.avg) : null)}</td>
                      <td className={TD_RIGHT}>{fmtAvg(stat.obp != null ? parseFloat(stat.obp) : null)}</td>
                      <td className={TD_RIGHT}>{fmtAvg(stat.slg != null ? parseFloat(stat.slg) : null)}</td>
                      <td className={TD_RIGHT_BOLD}>{fmtAvg(stat.ops != null ? parseFloat(stat.ops) : null)}</td>
                    </tr>
                  );
                }),
                // Monthly summary row
                <tr key={`month-${group.month}`} className="bg-surface-alt/70 font-medium">
                  <td className={`${STICKY_TD} bg-surface-alt/70`} colSpan={2}>
                    <span className="text-xs text-muted uppercase">{group.month}</span>
                  </td>
                  <td className={`${TD_LEFT} text-xs text-muted`}>{monthTotals.games} G</td>
                  <td className={TD_RIGHT}>{monthTotals.ab}</td>
                  <td className={TD_RIGHT}>{monthTotals.r}</td>
                  <td className={TD_RIGHT_BOLD}>{monthTotals.h}</td>
                  <td className={TD_RIGHT}>{monthTotals.doubles}</td>
                  <td className={TD_RIGHT}>{monthTotals.triples}</td>
                  <td className={TD_RIGHT_BOLD}>{monthTotals.hr}</td>
                  <td className={TD_RIGHT}>{monthTotals.rbi}</td>
                  <td className={TD_RIGHT}>{monthTotals.bb}</td>
                  <td className={TD_RIGHT}>{monthTotals.so}</td>
                  <td className={TD_RIGHT}>{monthTotals.sb}</td>
                  <td className={TD_RIGHT}>{fmtAvg(monthAvg)}</td>
                  <td className={TD_RIGHT}>{fmtAvg(monthOBP)}</td>
                  <td className={TD_RIGHT}>{fmtAvg(monthSLG)}</td>
                  <td className={TD_RIGHT_BOLD}>{fmtAvg(monthOPS)}</td>
                </tr>,
              ];
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold bg-surface-alt">
              <td className={`${STICKY_TD} bg-surface-alt`} colSpan={2}>
                Season Totals
              </td>
              <td className={`${TD_LEFT} text-xs text-muted`}>{seasonTotals.games} G</td>
              <td className={TD_RIGHT}>{seasonTotals.ab}</td>
              <td className={TD_RIGHT}>{seasonTotals.r}</td>
              <td className={TD_RIGHT_BOLD}>{seasonTotals.h}</td>
              <td className={TD_RIGHT}>{seasonTotals.doubles}</td>
              <td className={TD_RIGHT}>{seasonTotals.triples}</td>
              <td className={TD_RIGHT_BOLD}>{seasonTotals.hr}</td>
              <td className={TD_RIGHT}>{seasonTotals.rbi}</td>
              <td className={TD_RIGHT}>{seasonTotals.bb}</td>
              <td className={TD_RIGHT}>{seasonTotals.so}</td>
              <td className={TD_RIGHT}>{seasonTotals.sb}</td>
              <td className={TD_RIGHT}>{fmtAvg(seasonAvg)}</td>
              <td className={TD_RIGHT}>{fmtAvg(seasonOBP)}</td>
              <td className={TD_RIGHT}>{fmtAvg(seasonSLG)}</td>
              <td className={TD_RIGHT_BOLD}>{fmtAvg(seasonOPS)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pitching table                                                     */
/* ------------------------------------------------------------------ */
function PitchingGameLog({ splits, season }: { splits: Split[]; season: string }) {
  if (splits.length === 0) return null;

  const seasonTotals = accumulatePitchingTotals(splits);
  const seasonERA = computeERA(seasonTotals);

  const pitchingCols = [
    "Date", "Opp", "Result", "Dec", "IP", "H", "R", "ER", "BB", "SO", "HR", "ERA",
  ];

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold">{season} Pitching Game Log</h2>
      </div>
      <div className="stat-scroll overflow-x-auto">
        <table className="stat-table w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {pitchingCols.map((col, i) => (
                <th key={col} className={i < 4 ? (i === 0 ? STICKY_TH : TH_LEFT) : TH_RIGHT}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {splits.map((split: Split, idx: number) => {
              const stat = split.stat || {};
              const opponent = split.opponent?.abbreviation || "";
              const isHome = split.isHome;
              const prefix = isHome ? "vs" : "@";
              const result = buildResultString(split);
              const dec = getDecision(split);

              return (
                <tr key={`${split.date}-${idx}`} className="hover:bg-surface-alt/50">
                  <td className={STICKY_TD}>{formatGameDate(split.date)}</td>
                  <td className={TD_LEFT}>
                    <span className="text-muted-light">{prefix}</span>{" "}
                    {opponent}
                  </td>
                  <td className={`${TD_LEFT} ${split.isWin ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                    {result}
                  </td>
                  <td className={`${TD_LEFT} font-medium ${
                    dec === "W"
                      ? "text-green-600 dark:text-green-400"
                      : dec === "L"
                        ? "text-red-500 dark:text-red-400"
                        : dec === "S"
                          ? "text-blue-600 dark:text-blue-400"
                          : ""
                  }`}>
                    {dec}
                  </td>
                  <td className={TD_RIGHT}>{stat.inningsPitched ?? "0.0"}</td>
                  <td className={TD_RIGHT}>{stat.hits ?? 0}</td>
                  <td className={TD_RIGHT}>{stat.runs ?? 0}</td>
                  <td className={TD_RIGHT}>{stat.earnedRuns ?? 0}</td>
                  <td className={TD_RIGHT}>{stat.baseOnBalls ?? 0}</td>
                  <td className={TD_RIGHT_BOLD}>{stat.strikeOuts ?? 0}</td>
                  <td className={TD_RIGHT}>{stat.homeRuns ?? 0}</td>
                  <td className={TD_RIGHT}>{fmtEra(stat.era != null ? parseFloat(stat.era) : null)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold bg-surface-alt">
              <td className={`${STICKY_TD} bg-surface-alt`} colSpan={3}>
                Season Totals
              </td>
              <td className={TD_LEFT}>{seasonTotals.games} GS</td>
              <td className={TD_RIGHT}>{formatIPTotal(seasonTotals.ip)}</td>
              <td className={TD_RIGHT}>{seasonTotals.h}</td>
              <td className={TD_RIGHT}>{seasonTotals.r}</td>
              <td className={TD_RIGHT}>{seasonTotals.er}</td>
              <td className={TD_RIGHT}>{seasonTotals.bb}</td>
              <td className={TD_RIGHT_BOLD}>{seasonTotals.so}</td>
              <td className={TD_RIGHT}>{seasonTotals.hr}</td>
              <td className={TD_RIGHT}>{fmtEra(seasonERA)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default async function GameLogPage({ params }: Props) {
  const { id, season } = await params;
  const player = await getPlayer(id);

  if (!player) notFound();
  if (!player.mlbamID) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-muted">
          Game log data is not available for this player (no MLB Stats API ID).
        </p>
      </div>
    );
  }

  const name = fullName(player.nameFirst, player.nameLast, player.nameGiven, player.nameSuffix);
  const seasonNum = parseInt(season, 10);

  // Fetch both hitting and pitching game logs in parallel
  const [hittingSplits, pitchingSplits] = await Promise.all([
    fetchGameLog(player.mlbamID, season, "hitting"),
    fetchGameLog(player.mlbamID, season, "pitching"),
  ]);

  const hasHitting = hittingSplits.length > 0;
  const hasPitching = pitchingSplits.length > 0;

  // Determine available seasons from DB batting/pitching records
  const [battingYears, pitchingYears] = await Promise.all([
    prisma.batting.findMany({
      where: { playerID: id },
      select: { yearID: true },
      distinct: ["yearID"],
      orderBy: { yearID: "asc" },
    }),
    prisma.pitching.findMany({
      where: { playerID: id },
      select: { yearID: true },
      distinct: ["yearID"],
      orderBy: { yearID: "asc" },
    }),
  ]);

  const allYears = [
    ...new Set([
      ...battingYears.map((b) => b.yearID),
      ...pitchingYears.map((p) => p.yearID),
    ]),
  ].sort((a, b) => a - b);

  // Only show season nav for seasons that might have MLB API data (roughly 2000+)
  const navYears = allYears.filter((y) => y >= 2000);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/baseball" className="text-xs text-muted hover:text-foreground transition-colors">
          Baseball
        </Link>
        <span className="text-xs text-muted-light">/</span>
        <Link href="/baseball/players" className="text-xs text-muted hover:text-foreground transition-colors">
          Players
        </Link>
        <span className="text-xs text-muted-light">/</span>
        <Link href={`/baseball/players/${id}`} className="text-xs text-muted hover:text-foreground transition-colors">
          {name}
        </Link>
        <span className="text-xs text-muted-light">/</span>
        <span className="text-xs text-foreground font-medium">{season} Game Log</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {name}
        </h1>
        <p className="text-muted mt-1">{season} Game Log</p>
      </div>

      {/* Season navigation */}
      {navYears.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted uppercase tracking-wider mr-2">Season:</span>
          {navYears.map((year) => (
            <Link
              key={year}
              href={`/baseball/players/${id}/gamelog/${year}`}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                year === seasonNum
                  ? "bg-accent text-white font-medium"
                  : "text-muted hover:text-foreground hover:bg-surface-alt"
              }`}
            >
              {year}
            </Link>
          ))}
        </div>
      )}

      {/* Back to player link */}
      <div className="mb-6">
        <Link href={`/baseball/players/${id}`} className={`text-sm ${LINK_CLASSES}`}>
          &larr; Back to player page
        </Link>
      </div>

      {/* No data message */}
      {!hasHitting && !hasPitching && (
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <p className="text-muted">
            No game log data available for {name} in {season}.
          </p>
          <p className="text-sm text-muted-light mt-2">
            Game logs are available from the MLB Stats API for recent seasons only.
          </p>
        </div>
      )}

      {/* Batting game log */}
      {hasHitting && (
        <div className="mb-8">
          <BattingGameLog splits={hittingSplits} season={season} />
        </div>
      )}

      {/* Pitching game log */}
      {hasPitching && (
        <div className="mb-8">
          <PitchingGameLog splits={pitchingSplits} season={season} />
        </div>
      )}
    </div>
  );
}
