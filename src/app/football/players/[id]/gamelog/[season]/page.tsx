import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { fmtInt } from "@/lib/format";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  Style constants                                                    */
/* ------------------------------------------------------------------ */
const TH_LEFT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left";
const TH_RIGHT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-right";
const TD_LEFT = "py-2 px-2.5 text-left text-sm";
const TD_RIGHT = "py-2 px-2.5 text-right font-mono text-xs";
const TD_RIGHT_BOLD = "py-2 px-2.5 text-right font-mono text-xs font-medium";
const LINK_CLASSES =
  "text-link hover:text-link-hover hover:underline transition-colors";
const STICKY_TH =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left sticky left-0 z-20 bg-surface";
const STICKY_TD =
  "py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface text-sm";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function passerRating(
  comp: number,
  att: number,
  yds: number,
  td: number,
  int_: number
): number | null {
  if (att === 0) return null;
  const a = Math.max(0, Math.min((comp / att - 0.3) * 5, 2.375));
  const b = Math.max(0, Math.min((yds / att - 3) * 0.25, 2.375));
  const c = Math.max(0, Math.min((td / att) * 20, 2.375));
  const d = Math.max(0, Math.min(2.375 - (int_ / att) * 25, 2.375));
  return ((a + b + c + d) / 6) * 100;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  params: Promise<{ id: string; season: string }>;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, season } = await params;
  const player = await prisma.nFLPlayer.findUnique({
    where: { id },
    select: { displayName: true, firstName: true, lastName: true },
  });
  if (!player) return { title: "Player Not Found" };
  const name = player.displayName || `${player.firstName} ${player.lastName}`;
  return { title: `${name} - ${season} Game Log` };
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */
async function getGameLogData(id: string, season: number) {
  const player = await prisma.nFLPlayer.findUnique({ where: { id } });
  if (!player) return null;

  const [weeklyStats, games] = await Promise.all([
    prisma.nFLWeeklyStats.findMany({
      where: { playerId: id, season },
      orderBy: [{ seasonType: "asc" }, { week: "asc" }],
    }),
    prisma.nFLGame.findMany({
      where: { season },
      select: {
        week: true,
        gameType: true,
        homeTeam: true,
        awayTeam: true,
        homeScore: true,
        awayScore: true,
      },
    }),
  ]);

  // Build a lookup: team+week+seasonType -> game result
  const gameMap = new Map<
    string,
    { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number }
  >();
  for (const g of games) {
    if (g.homeTeam && g.awayTeam && g.homeScore !== null && g.awayScore !== null && g.week !== null) {
      const type = g.gameType === "POST" ? "POST" : "REG";
      gameMap.set(`${g.homeTeam}|${g.week}|${type}`, {
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
      });
      gameMap.set(`${g.awayTeam}|${g.week}|${type}`, {
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
      });
    }
  }

  return { player, weeklyStats, gameMap };
}

function getGameResult(
  team: string | null,
  week: number,
  seasonType: string | null,
  gameMap: Map<string, { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number }>
): string {
  if (!team) return "\u2014";
  const key = `${team}|${week}|${seasonType || "REG"}`;
  const game = gameMap.get(key);
  if (!game) return "\u2014";

  const isHome = game.homeTeam === team;
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const oppScore = isHome ? game.awayScore : game.homeScore;
  const wl = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "T";
  return `${wl} ${teamScore}-${oppScore}`;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default async function GameLogPage({ params }: Props) {
  const { id, season: seasonStr } = await params;
  const season = parseInt(seasonStr, 10);
  if (isNaN(season)) notFound();

  const data = await getGameLogData(id, season);
  if (!data || data.weeklyStats.length === 0) notFound();

  const { player, weeklyStats, gameMap } = data;

  const name =
    player.displayName ||
    [player.firstName, player.lastName, player.suffix].filter(Boolean).join(" ");
  const pos = player.position || "Unknown";

  const isQB = pos === "QB";
  const isRB = pos === "RB" || pos === "FB";
  // WR/TE for everyone else with receiving stats
  const isWRTE = pos === "WR" || pos === "TE";

  // Compute season totals
  const totals = weeklyStats.reduce(
    (acc, s) => ({
      completions: acc.completions + (s.completions || 0),
      passAttempts: acc.passAttempts + (s.passAttempts || 0),
      passYards: acc.passYards + (s.passYards || 0),
      passTds: acc.passTds + (s.passTds || 0),
      interceptions: acc.interceptions + (s.interceptions || 0),
      sacks: acc.sacks + (s.sacks || 0),
      carries: acc.carries + (s.carries || 0),
      rushYards: acc.rushYards + (s.rushYards || 0),
      rushTds: acc.rushTds + (s.rushTds || 0),
      receptions: acc.receptions + (s.receptions || 0),
      targets: acc.targets + (s.targets || 0),
      recYards: acc.recYards + (s.recYards || 0),
      recTds: acc.recTds + (s.recTds || 0),
      fumbles: acc.fumbles + (s.fumbles || 0),
    }),
    {
      completions: 0,
      passAttempts: 0,
      passYards: 0,
      passTds: 0,
      interceptions: 0,
      sacks: 0,
      carries: 0,
      rushYards: 0,
      rushTds: 0,
      receptions: 0,
      targets: 0,
      recYards: 0,
      recTds: 0,
      fumbles: 0,
    }
  );

  const totalRating = passerRating(
    totals.completions,
    totals.passAttempts,
    totals.passYards,
    totals.passTds,
    totals.interceptions
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/football"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          Football
        </Link>
        <span className="text-xs text-muted-light">/</span>
        <Link
          href={`/football/players/${id}`}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {name}
        </Link>
        <span className="text-xs text-muted-light">/</span>
        <span className="text-xs text-muted">Game Log</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
        {player.headshot && (
          <img
            src={player.headshot}
            alt={name}
            className="w-16 h-16 rounded-lg object-cover bg-surface-alt"
          />
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter">
            {name}{" "}
            <span className="text-muted font-normal">{season} Game Log</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            {pos}
            {player.latestTeam && ` \u2022 `}
            {player.latestTeam && (
              <Link href={`/football/teams/${player.latestTeam}`} className={LINK_CLASSES}>
                {player.latestTeam}
              </Link>
            )}
          </p>
        </div>
      </div>

      {/* QB Game Log */}
      {isQB && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Passing Game Log
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={STICKY_TH}>Wk</th>
                    {["Opp", "Result", "Comp", "Att", "Pct", "Yds", "TD", "INT", "Sacks", "Rating"].map(
                      (col) => (
                        <th
                          key={col}
                          className={col === "Opp" || col === "Result" ? TH_LEFT : TH_RIGHT}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {weeklyStats.map((s) => {
                    const cmp = s.completions || 0;
                    const att = s.passAttempts || 0;
                    const pct = att > 0 ? ((cmp / att) * 100).toFixed(1) : "\u2014";
                    const rating = passerRating(
                      cmp, att, s.passYards || 0, s.passTds || 0, s.interceptions || 0
                    );
                    const result = getGameResult(s.team, s.week, s.seasonType, gameMap);
                    const typePrefix = s.seasonType === "POST" ? "P" : "";
                    return (
                      <tr key={`${s.seasonType}-${s.week}`}>
                        <td className={STICKY_TD}>
                          {typePrefix}{s.week}
                        </td>
                        <td className={TD_LEFT}>
                          {s.opponent ? (
                            <Link href={`/football/teams/${s.opponent}/${season}`} className={LINK_CLASSES}>
                              {s.opponent}
                            </Link>
                          ) : "\u2014"}
                        </td>
                        <td className={`${TD_LEFT} ${
                          result.startsWith("W") ? "text-green-600 dark:text-green-400" :
                          result.startsWith("L") ? "text-red-500 dark:text-red-400" : ""
                        }`}>
                          {result}
                        </td>
                        <td className={TD_RIGHT}>{cmp}</td>
                        <td className={TD_RIGHT}>{att}</td>
                        <td className={TD_RIGHT}>{pct}</td>
                        <td className={TD_RIGHT_BOLD}>{fmtInt(s.passYards || 0)}</td>
                        <td className={TD_RIGHT_BOLD}>{s.passTds || 0}</td>
                        <td className={TD_RIGHT}>{s.interceptions || 0}</td>
                        <td className={TD_RIGHT}>{s.sacks || 0}</td>
                        <td className={TD_RIGHT_BOLD}>
                          {rating !== null ? rating.toFixed(1) : "\u2014"}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Season totals */}
                  <tr className="border-t-2 border-border font-medium bg-surface-alt">
                    <td className={STICKY_TD}>Total</td>
                    <td className={TD_LEFT}></td>
                    <td className={TD_LEFT}></td>
                    <td className={TD_RIGHT}>{fmtInt(totals.completions)}</td>
                    <td className={TD_RIGHT}>{fmtInt(totals.passAttempts)}</td>
                    <td className={TD_RIGHT}>
                      {totals.passAttempts > 0
                        ? ((totals.completions / totals.passAttempts) * 100).toFixed(1)
                        : "\u2014"}
                    </td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.passYards)}</td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.passTds)}</td>
                    <td className={TD_RIGHT}>{fmtInt(totals.interceptions)}</td>
                    <td className={TD_RIGHT}>{fmtInt(totals.sacks)}</td>
                    <td className={TD_RIGHT_BOLD}>
                      {totalRating !== null ? totalRating.toFixed(1) : "\u2014"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* RB Game Log */}
      {isRB && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Rushing/Receiving Game Log
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={STICKY_TH}>Wk</th>
                    {["Opp", "Result", "Car", "Yds", "Y/A", "TD", "Rec", "RecYds", "RecTD"].map(
                      (col) => (
                        <th
                          key={col}
                          className={col === "Opp" || col === "Result" ? TH_LEFT : TH_RIGHT}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {weeklyStats.map((s) => {
                    const car = s.carries || 0;
                    const yds = s.rushYards || 0;
                    const ya = car > 0 ? (yds / car).toFixed(1) : "\u2014";
                    const result = getGameResult(s.team, s.week, s.seasonType, gameMap);
                    const typePrefix = s.seasonType === "POST" ? "P" : "";
                    return (
                      <tr key={`${s.seasonType}-${s.week}`}>
                        <td className={STICKY_TD}>{typePrefix}{s.week}</td>
                        <td className={TD_LEFT}>
                          {s.opponent ? (
                            <Link href={`/football/teams/${s.opponent}/${season}`} className={LINK_CLASSES}>
                              {s.opponent}
                            </Link>
                          ) : "\u2014"}
                        </td>
                        <td className={`${TD_LEFT} ${
                          result.startsWith("W") ? "text-green-600 dark:text-green-400" :
                          result.startsWith("L") ? "text-red-500 dark:text-red-400" : ""
                        }`}>
                          {result}
                        </td>
                        <td className={TD_RIGHT}>{car}</td>
                        <td className={TD_RIGHT_BOLD}>{fmtInt(yds)}</td>
                        <td className={TD_RIGHT}>{ya}</td>
                        <td className={TD_RIGHT_BOLD}>{s.rushTds || 0}</td>
                        <td className={TD_RIGHT}>{s.receptions || 0}</td>
                        <td className={TD_RIGHT}>{fmtInt(s.recYards || 0)}</td>
                        <td className={TD_RIGHT}>{s.recTds || 0}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border font-medium bg-surface-alt">
                    <td className={STICKY_TD}>Total</td>
                    <td className={TD_LEFT}></td>
                    <td className={TD_LEFT}></td>
                    <td className={TD_RIGHT}>{fmtInt(totals.carries)}</td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.rushYards)}</td>
                    <td className={TD_RIGHT}>
                      {totals.carries > 0 ? (totals.rushYards / totals.carries).toFixed(1) : "\u2014"}
                    </td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.rushTds)}</td>
                    <td className={TD_RIGHT}>{fmtInt(totals.receptions)}</td>
                    <td className={TD_RIGHT}>{fmtInt(totals.recYards)}</td>
                    <td className={TD_RIGHT}>{fmtInt(totals.recTds)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* WR/TE Game Log */}
      {(isWRTE || (!isQB && !isRB)) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Receiving Game Log
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={STICKY_TH}>Wk</th>
                    {["Opp", "Result", "Tgt", "Rec", "Yds", "Y/R", "TD"].map(
                      (col) => (
                        <th
                          key={col}
                          className={col === "Opp" || col === "Result" ? TH_LEFT : TH_RIGHT}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {weeklyStats.map((s) => {
                    const rec = s.receptions || 0;
                    const yds = s.recYards || 0;
                    const yr = rec > 0 ? (yds / rec).toFixed(1) : "\u2014";
                    const result = getGameResult(s.team, s.week, s.seasonType, gameMap);
                    const typePrefix = s.seasonType === "POST" ? "P" : "";
                    return (
                      <tr key={`${s.seasonType}-${s.week}`}>
                        <td className={STICKY_TD}>{typePrefix}{s.week}</td>
                        <td className={TD_LEFT}>
                          {s.opponent ? (
                            <Link href={`/football/teams/${s.opponent}/${season}`} className={LINK_CLASSES}>
                              {s.opponent}
                            </Link>
                          ) : "\u2014"}
                        </td>
                        <td className={`${TD_LEFT} ${
                          result.startsWith("W") ? "text-green-600 dark:text-green-400" :
                          result.startsWith("L") ? "text-red-500 dark:text-red-400" : ""
                        }`}>
                          {result}
                        </td>
                        <td className={TD_RIGHT}>{s.targets || 0}</td>
                        <td className={TD_RIGHT_BOLD}>{rec}</td>
                        <td className={TD_RIGHT_BOLD}>{fmtInt(yds)}</td>
                        <td className={TD_RIGHT}>{yr}</td>
                        <td className={TD_RIGHT_BOLD}>{s.recTds || 0}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border font-medium bg-surface-alt">
                    <td className={STICKY_TD}>Total</td>
                    <td className={TD_LEFT}></td>
                    <td className={TD_LEFT}></td>
                    <td className={TD_RIGHT}>{fmtInt(totals.targets)}</td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.receptions)}</td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.recYards)}</td>
                    <td className={TD_RIGHT}>
                      {totals.receptions > 0 ? (totals.recYards / totals.receptions).toFixed(1) : "\u2014"}
                    </td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.recTds)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* QB also gets rushing game log if they have rush stats */}
      {isQB && totals.carries > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Rushing Game Log
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={STICKY_TH}>Wk</th>
                    {["Opp", "Car", "Yds", "Y/A", "TD"].map((col) => (
                      <th
                        key={col}
                        className={col === "Opp" ? TH_LEFT : TH_RIGHT}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {weeklyStats
                    .filter((s) => (s.carries || 0) > 0)
                    .map((s) => {
                      const car = s.carries || 0;
                      const yds = s.rushYards || 0;
                      const ya = car > 0 ? (yds / car).toFixed(1) : "\u2014";
                      const typePrefix = s.seasonType === "POST" ? "P" : "";
                      return (
                        <tr key={`qb-rush-${s.seasonType}-${s.week}`}>
                          <td className={STICKY_TD}>{typePrefix}{s.week}</td>
                          <td className={TD_LEFT}>
                            {s.opponent ? (
                              <Link href={`/football/teams/${s.opponent}/${season}`} className={LINK_CLASSES}>
                                {s.opponent}
                              </Link>
                            ) : "\u2014"}
                          </td>
                          <td className={TD_RIGHT}>{car}</td>
                          <td className={TD_RIGHT_BOLD}>{fmtInt(yds)}</td>
                          <td className={TD_RIGHT}>{ya}</td>
                          <td className={TD_RIGHT_BOLD}>{s.rushTds || 0}</td>
                        </tr>
                      );
                    })}
                  <tr className="border-t-2 border-border font-medium bg-surface-alt">
                    <td className={STICKY_TD}>Total</td>
                    <td className={TD_LEFT}></td>
                    <td className={TD_RIGHT}>{fmtInt(totals.carries)}</td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.rushYards)}</td>
                    <td className={TD_RIGHT}>
                      {totals.carries > 0 ? (totals.rushYards / totals.carries).toFixed(1) : "\u2014"}
                    </td>
                    <td className={TD_RIGHT_BOLD}>{fmtInt(totals.rushTds)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
