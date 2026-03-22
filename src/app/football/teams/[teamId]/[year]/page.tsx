import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { fmtInt } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const TH_LEFT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left";
const TH_RIGHT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-right";
const TD_LEFT = "py-2 px-2.5 text-left";
const TD_RIGHT = "py-2 px-2.5 text-right font-mono text-xs";
const TD_RIGHT_BOLD = "py-2 px-2.5 text-right font-mono text-xs font-medium";
const LINK_CLASSES =
  "text-link hover:text-link-hover hover:underline transition-colors";
const STICKY_TH =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left sticky left-0 z-20 bg-surface";
const STICKY_TD =
  "py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface whitespace-nowrap";

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
  params: Promise<{ teamId: string; year: string }>;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId, year } = await params;
  const team = await prisma.nFLTeam.findUnique({
    where: { teamAbbr: teamId },
    select: { teamName: true, teamNick: true },
  });
  const name = team ? `${team.teamName || team.teamNick}` : teamId;
  return { title: `${name} ${year}` };
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */
async function getTeamSeasonData(teamId: string, year: number) {
  const [team, standings, playerStats, games] = await Promise.all([
    prisma.nFLTeam.findUnique({ where: { teamAbbr: teamId } }),
    prisma.nFLStandings.findFirst({
      where: { team: teamId, season: year },
    }),
    prisma.nFLPlayerStats.findMany({
      where: { team: teamId, season: year, seasonType: "REG" },
      include: {
        player: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            position: true,
            jerseyNumber: true,
            headshot: true,
          },
        },
      },
      orderBy: [{ games: "desc" }],
    }),
    prisma.nFLGame.findMany({
      where: {
        season: year,
        OR: [{ homeTeam: teamId }, { awayTeam: teamId }],
      },
      orderBy: [{ week: "asc" }],
    }),
  ]);

  if (!team && !standings && playerStats.length === 0 && games.length === 0) {
    return null;
  }

  // Check for prev/next seasons
  const [prevStandings, nextStandings] = await Promise.all([
    prisma.nFLStandings.findFirst({
      where: { team: teamId, season: year - 1 },
      select: { season: true },
    }),
    prisma.nFLStandings.findFirst({
      where: { team: teamId, season: year + 1 },
      select: { season: true },
    }),
  ]);

  // Find the head coach from games
  const firstHomeGame = games.find((g) => g.homeTeam === teamId);
  const firstAwayGame = games.find((g) => g.awayTeam === teamId);
  const coach = firstHomeGame?.homeCoach || firstAwayGame?.awayCoach || null;

  return {
    team,
    standings,
    playerStats,
    games,
    coach,
    prevSeason: prevStandings?.season || null,
    nextSeason: nextStandings?.season || null,
  };
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default async function NFLTeamSeasonPage({ params }: Props) {
  const { teamId, year: yearStr } = await params;
  const year = parseInt(yearStr);
  const data = await getTeamSeasonData(teamId, year);

  if (!data) notFound();

  const { team, standings, playerStats, games, coach, prevSeason, nextSeason } =
    data;

  const teamName = team
    ? `${team.teamName || team.teamNick || ""}`.trim()
    : teamId;

  const record = standings
    ? standings.ties && standings.ties > 0
      ? `${standings.wins ?? 0}-${standings.losses ?? 0}-${standings.ties}`
      : `${standings.wins ?? 0}-${standings.losses ?? 0}`
    : null;

  // Group players by position
  const posGroups: Record<string, typeof playerStats> = {};
  const posOrder = ["QB", "RB", "FB", "WR", "TE", "K"];
  for (const ps of playerStats) {
    const pos = ps.player.position || ps.position || "Other";
    const group = posOrder.includes(pos) ? pos : "Other";
    if (!posGroups[group]) posGroups[group] = [];
    posGroups[group].push(ps);
  }

  // Build schedule
  const schedule = games
    .filter((g) => g.gameType === "REG" || !g.gameType)
    .map((g) => {
      const isHome = g.homeTeam === teamId;
      const opponent = isHome ? g.awayTeam : g.homeTeam;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      const prefix = isHome ? "vs" : "@";
      let result = "\u2014";
      if (teamScore !== null && oppScore !== null) {
        if (teamScore > oppScore) result = "W";
        else if (teamScore < oppScore) result = "L";
        else result = "T";
      }
      return {
        gameId: g.gameId,
        week: g.week,
        gameday: g.gameday,
        opponent,
        prefix,
        teamScore,
        oppScore,
        result,
        overtime: g.overtime,
      };
    });

  // Postseason games
  const postGames = games
    .filter((g) => ["WC", "DIV", "CON", "SB"].includes(g.gameType || ""))
    .map((g) => {
      const isHome = g.homeTeam === teamId;
      const opponent = isHome ? g.awayTeam : g.homeTeam;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      const prefix = isHome ? "vs" : "@";
      let result = "\u2014";
      if (teamScore !== null && oppScore !== null) {
        if (teamScore > oppScore) result = "W";
        else if (teamScore < oppScore) result = "L";
        else result = "T";
      }
      return {
        gameId: g.gameId,
        week: g.week,
        gameday: g.gameday,
        gameType: g.gameType,
        opponent,
        prefix,
        teamScore,
        oppScore,
        result,
        overtime: g.overtime,
      };
    });

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
          href="/football/teams"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          Teams
        </Link>
        <span className="text-xs text-muted-light">/</span>
        <Link
          href={`/football/teams/${teamId}`}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {teamId}
        </Link>
        <span className="text-xs text-muted-light">/</span>
      </div>

      {/* Team Header */}
      <div className="flex items-start gap-4 mb-6">
        {team?.teamLogo && (
          <img
            src={team.teamLogo}
            alt={teamName}
            width={64}
            height={64}
            className="w-16 h-16 object-contain"
            
         />
        )}
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
            {year}{" "}
            <span className="text-muted">{teamName}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted">
            {record && <span className="font-mono font-medium text-foreground">{record}</span>}
            {standings?.division && (
              <span>
                {standings.conf} {standings.division}
              </span>
            )}
            {standings?.divRank && <span>{standings.divRank === 1 ? "Division Winner" : `${standings.divRank}${standings.divRank === 2 ? "nd" : standings.divRank === 3 ? "rd" : "th"} in Division`}</span>}
            {coach && <span>Coach: {coach}</span>}
            {standings?.playoff && (
              <span className="text-accent font-medium">{standings.playoff}</span>
            )}
          </div>
        </div>
      </div>

      {/* Nav: prev/next season */}
      <div className="flex flex-wrap gap-3 mb-10">
        {prevSeason && (
          <Link
            href={`/football/teams/${teamId}/${prevSeason}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
          >
            {prevSeason}
          </Link>
        )}
        <Link
          href={`/football/seasons/${year}`}
          className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
        >
          {year} Season Overview
        </Link>
        {nextSeason && (
          <Link
            href={`/football/teams/${teamId}/${nextSeason}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
          >
            {nextSeason}
          </Link>
        )}
      </div>

      {/* Team Stat Cards */}
      {standings && (
        <section className="mb-10 flex flex-wrap gap-8">
          <StatCard
            label="Record"
            value={record || "\u2014"}
         />
          <StatCard
            label="Points Scored"
            value={standings.scored !== null ? fmtInt(standings.scored) : "\u2014"}
         />
          <StatCard
            label="Points Allowed"
            value={standings.allowed !== null ? fmtInt(standings.allowed) : "\u2014"}
         />
          <StatCard
            label="Point Diff"
            value={
              standings.scored !== null && standings.allowed !== null
                ? (standings.scored - standings.allowed > 0 ? "+" : "") +
                  (standings.scored - standings.allowed)
                : "\u2014"
            }
         />
        </section>
      )}

      {/* Schedule */}
      {schedule.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Regular Season Schedule
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Wk", "Date", "Opp", "Result", "Score"].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider ${
                          col === "Wk" ? "text-center w-12" : "text-left"
                        }`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {schedule.map((g) => (
                    <tr key={`w${g.week}`}>
                      <td className="py-2 px-3 text-center font-mono text-xs">
                        {g.week ?? "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-left text-xs text-muted">
                        {g.gameday || "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-left text-sm">
                        <span className="text-muted text-xs mr-1">
                          {g.prefix}
                        </span>
                        {g.opponent ? (
                          <Link
                            href={`/football/teams/${g.opponent}/${year}`}
                            className={LINK_CLASSES}
                          >
                            {g.opponent}
                          </Link>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td className="py-2 px-3 text-left">
                        <span
                          className={`text-xs font-medium ${
                            g.result === "W"
                              ? "text-green-600 dark:text-green-400"
                              : g.result === "L"
                                ? "text-red-500"
                                : "text-muted"
                          }`}
                        >
                          {g.result}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-left font-mono text-xs">
                        {g.teamScore !== null && g.oppScore !== null ? (
                          <Link
                            href={`/football/games/${g.gameId}`}
                            className={LINK_CLASSES}
                          >
                            {g.teamScore}-{g.oppScore}
                          </Link>
                        ) : (
                          "\u2014"
                        )}
                        {g.overtime && (
                          <span className="text-muted ml-1">(OT)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Postseason Games */}
      {postGames.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Postseason
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Round", "Date", "Opp", "Result", "Score"].map((col) => (
                      <th
                        key={col}
                        className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-left"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {postGames.map((g, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 text-left text-xs font-medium">
                        {g.gameType === "SB"
                          ? "Super Bowl"
                          : `Wk ${g.week}`}
                      </td>
                      <td className="py-2 px-3 text-left text-xs text-muted">
                        {g.gameday || "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-left text-sm">
                        <span className="text-muted text-xs mr-1">
                          {g.prefix}
                        </span>
                        {g.opponent ? (
                          <Link
                            href={`/football/teams/${g.opponent}/${year}`}
                            className={LINK_CLASSES}
                          >
                            {g.opponent}
                          </Link>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td className="py-2 px-3 text-left">
                        <span
                          className={`text-xs font-medium ${
                            g.result === "W"
                              ? "text-green-600 dark:text-green-400"
                              : g.result === "L"
                                ? "text-red-500"
                                : "text-muted"
                          }`}
                        >
                          {g.result}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-left font-mono text-xs">
                        {g.teamScore !== null && g.oppScore !== null ? (
                          <Link
                            href={`/football/games/${g.gameId}`}
                            className={LINK_CLASSES}
                          >
                            {g.teamScore}-{g.oppScore}
                          </Link>
                        ) : (
                          "\u2014"
                        )}
                        {g.overtime && (
                          <span className="text-muted ml-1">(OT)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Roster by Position Group */}
      {playerStats.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">Roster</h2>

          {/* Quarterbacks */}
          {posGroups["QB"] && posGroups["QB"].length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                Quarterbacks
              </h3>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={STICKY_TH}>Player</th>
                        {["G", "Comp", "Att", "Yds", "TD", "INT", "Rating", "RuYds", "RuTD"].map(
                          (col) => (
                            <th key={col} className={TH_RIGHT}>
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {posGroups["QB"].map((ps) => {
                        const rating = passerRating(
                          ps.completions || 0,
                          ps.passAttempts || 0,
                          ps.passYards || 0,
                          ps.passTds || 0,
                          ps.interceptions || 0
                        );
                        return (
                          <tr key={ps.id}>
                            <td className={STICKY_TD}>
                              <Link
                                href={`/football/players/${ps.player.id}`}
                                className={LINK_CLASSES}
                              >
                                {ps.player.displayName ||
                                  `${ps.player.firstName} ${ps.player.lastName}`}
                              </Link>
                            </td>
                            <td className={TD_RIGHT}>{ps.games || 0}</td>
                            <td className={TD_RIGHT}>{ps.completions || 0}</td>
                            <td className={TD_RIGHT}>{ps.passAttempts || 0}</td>
                            <td className={TD_RIGHT_BOLD}>
                              {fmtInt(ps.passYards || 0)}
                            </td>
                            <td className={TD_RIGHT_BOLD}>{ps.passTds || 0}</td>
                            <td className={TD_RIGHT}>{ps.interceptions || 0}</td>
                            <td className={TD_RIGHT}>
                              {rating !== null ? rating.toFixed(1) : "\u2014"}
                            </td>
                            <td className={TD_RIGHT}>
                              {fmtInt(ps.rushYards || 0)}
                            </td>
                            <td className={TD_RIGHT}>{ps.rushTds || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Running Backs */}
          {(posGroups["RB"] || posGroups["FB"]) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                Running Backs
              </h3>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={STICKY_TH}>Player</th>
                        {["G", "Car", "Yds", "Y/A", "TD", "Rec", "RecYds", "RecTD", "Fum"].map(
                          (col) => (
                            <th key={col} className={TH_RIGHT}>
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {[...(posGroups["RB"] || []), ...(posGroups["FB"] || [])]
                        .sort((a, b) => (b.rushYards || 0) - (a.rushYards || 0))
                        .map((ps) => {
                          const car = ps.carries || 0;
                          const ya =
                            car > 0
                              ? ((ps.rushYards || 0) / car).toFixed(1)
                              : "\u2014";
                          return (
                            <tr key={ps.id}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/players/${ps.player.id}`}
                                  className={LINK_CLASSES}
                                >
                                  {ps.player.displayName ||
                                    `${ps.player.firstName} ${ps.player.lastName}`}
                                </Link>
                              </td>
                              <td className={TD_RIGHT}>{ps.games || 0}</td>
                              <td className={TD_RIGHT}>{car}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {fmtInt(ps.rushYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{ya}</td>
                              <td className={TD_RIGHT_BOLD}>{ps.rushTds || 0}</td>
                              <td className={TD_RIGHT}>{ps.receptions || 0}</td>
                              <td className={TD_RIGHT}>
                                {fmtInt(ps.recYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{ps.recTds || 0}</td>
                              <td className={TD_RIGHT}>{ps.fumbles || 0}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Wide Receivers */}
          {posGroups["WR"] && posGroups["WR"].length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                Wide Receivers
              </h3>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={STICKY_TH}>Player</th>
                        {["G", "Tgt", "Rec", "Yds", "Y/R", "TD", "RuAtt", "RuYds", "RuTD"].map(
                          (col) => (
                            <th key={col} className={TH_RIGHT}>
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {posGroups["WR"]
                        .sort((a, b) => (b.recYards || 0) - (a.recYards || 0))
                        .map((ps) => {
                          const rec = ps.receptions || 0;
                          const yr =
                            rec > 0
                              ? ((ps.recYards || 0) / rec).toFixed(1)
                              : "\u2014";
                          return (
                            <tr key={ps.id}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/players/${ps.player.id}`}
                                  className={LINK_CLASSES}
                                >
                                  {ps.player.displayName ||
                                    `${ps.player.firstName} ${ps.player.lastName}`}
                                </Link>
                              </td>
                              <td className={TD_RIGHT}>{ps.games || 0}</td>
                              <td className={TD_RIGHT}>{ps.targets || 0}</td>
                              <td className={TD_RIGHT_BOLD}>{rec}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {fmtInt(ps.recYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{yr}</td>
                              <td className={TD_RIGHT_BOLD}>{ps.recTds || 0}</td>
                              <td className={TD_RIGHT}>{ps.carries || 0}</td>
                              <td className={TD_RIGHT}>
                                {fmtInt(ps.rushYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{ps.rushTds || 0}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tight Ends */}
          {posGroups["TE"] && posGroups["TE"].length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                Tight Ends
              </h3>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={STICKY_TH}>Player</th>
                        {["G", "Tgt", "Rec", "Yds", "Y/R", "TD"].map(
                          (col) => (
                            <th key={col} className={TH_RIGHT}>
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {posGroups["TE"]
                        .sort((a, b) => (b.recYards || 0) - (a.recYards || 0))
                        .map((ps) => {
                          const rec = ps.receptions || 0;
                          const yr =
                            rec > 0
                              ? ((ps.recYards || 0) / rec).toFixed(1)
                              : "\u2014";
                          return (
                            <tr key={ps.id}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/players/${ps.player.id}`}
                                  className={LINK_CLASSES}
                                >
                                  {ps.player.displayName ||
                                    `${ps.player.firstName} ${ps.player.lastName}`}
                                </Link>
                              </td>
                              <td className={TD_RIGHT}>{ps.games || 0}</td>
                              <td className={TD_RIGHT}>{ps.targets || 0}</td>
                              <td className={TD_RIGHT_BOLD}>{rec}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {fmtInt(ps.recYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{yr}</td>
                              <td className={TD_RIGHT_BOLD}>{ps.recTds || 0}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Kickers */}
          {posGroups["K"] && posGroups["K"].length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                Kickers
              </h3>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={STICKY_TH}>Player</th>
                        {["G", "Fantasy", "FantasyPPR"].map((col) => (
                          <th key={col} className={TH_RIGHT}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {posGroups["K"].map((ps) => (
                        <tr key={ps.id}>
                          <td className={STICKY_TD}>
                            <Link
                              href={`/football/players/${ps.player.id}`}
                              className={LINK_CLASSES}
                            >
                              {ps.player.displayName ||
                                `${ps.player.firstName} ${ps.player.lastName}`}
                            </Link>
                          </td>
                          <td className={TD_RIGHT}>{ps.games || 0}</td>
                          <td className={TD_RIGHT}>
                            {ps.fantasyPoints !== null
                              ? ps.fantasyPoints.toFixed(1)
                              : "\u2014"}
                          </td>
                          <td className={TD_RIGHT}>
                            {ps.fantasyPointsPpr !== null
                              ? ps.fantasyPointsPpr.toFixed(1)
                              : "\u2014"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {playerStats.length === 0 && schedule.length === 0 && (
        <div className="border border-border rounded-lg bg-surface p-8 text-center">
          <p className="text-muted">
            No data available for {teamName} in {year}.
          </p>
        </div>
      )}
    </div>
  );
}
