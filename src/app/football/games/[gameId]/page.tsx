import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtInt } from "@/lib/format";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TH_LEFT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left";
const TH_RIGHT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-right";
const TD_LEFT = "py-2 px-2.5 text-left text-sm";
const TD_RIGHT = "py-2 px-2.5 text-right font-mono text-xs";
const TD_RIGHT_BOLD = "py-2 px-2.5 text-right font-mono text-xs font-medium";
const STICKY_TH =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left sticky left-0 z-20 bg-surface";
const STICKY_TD =
  "py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface whitespace-nowrap";
const LINK_CLASSES =
  "text-link hover:text-link-hover hover:underline transition-colors";

/* ------------------------------------------------------------------ */
/*  Passer rating                                                      */
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
  params: Promise<{ gameId: string }>;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  const game = await prisma.nFLGame.findUnique({ where: { gameId } });
  if (!game) return { title: "Game Not Found" };
  return {
    title: `${game.awayTeam} ${game.awayScore ?? 0} @ ${game.homeTeam} ${game.homeScore ?? 0} - Week ${game.week}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */
async function getGameData(gameId: string) {
  const game = await prisma.nFLGame.findUnique({ where: { gameId } });
  if (!game) return null;

  // Get team info for both teams
  const [awayTeamInfo, homeTeamInfo] = await Promise.all([
    game.awayTeam
      ? prisma.nFLTeam.findUnique({ where: { teamAbbr: game.awayTeam } })
      : null,
    game.homeTeam
      ? prisma.nFLTeam.findUnique({ where: { teamAbbr: game.homeTeam } })
      : null,
  ]);

  // Determine season type for weekly stats query
  const seasonType = game.gameType === "REG" ? "REG" : "POST";

  // Get weekly stats for both teams in this game's week
  const rawStats = game.week
    ? await prisma.nFLWeeklyStats.findMany({
        where: {
          season: game.season,
          week: game.week,
          seasonType,
          OR: [
            { team: game.awayTeam || undefined },
            { team: game.homeTeam || undefined },
          ],
        },
      })
    : [];

  // Look up player info for all players in these stats
  const playerIds = [...new Set(rawStats.map((s) => s.playerId))];
  const players =
    playerIds.length > 0
      ? await prisma.nFLPlayer.findMany({
          where: { id: { in: playerIds } },
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        })
      : [];
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Merge player info into stats
  const weeklyStats = rawStats.map((s) => ({
    ...s,
    player: playerMap.get(s.playerId) || {
      id: s.playerId,
      displayName: null as string | null,
      firstName: null as string | null,
      lastName: null as string | null,
      position: null as string | null,
    },
  }));

  // Split stats by team
  const awayStats = weeklyStats.filter((s) => s.team === game.awayTeam);
  const homeStats = weeklyStats.filter((s) => s.team === game.homeTeam);

  return { game, awayTeamInfo, homeTeamInfo, awayStats, homeStats };
}

/* ------------------------------------------------------------------ */
/*  Aggregate helpers                                                   */
/* ------------------------------------------------------------------ */
function aggregateTeamStats(
  stats: Array<{
    passYards?: number | null;
    rushYards?: number | null;
    recYards?: number | null;
    interceptions?: number | null;
    fumblesLost?: number | null;
    completions?: number | null;
    passAttempts?: number | null;
    passTds?: number | null;
    carries?: number | null;
    rushTds?: number | null;
    receptions?: number | null;
    recTds?: number | null;
    sacks?: number | null;
    sackYards?: number | null;
  }>
) {
  let passYards = 0;
  let rushYards = 0;
  let turnovers = 0;
  let completions = 0;
  let passAttempts = 0;
  let passTds = 0;
  let carries = 0;
  let rushTds = 0;
  let receptions = 0;
  let recTds = 0;
  let sacks = 0;
  let sackYards = 0;

  for (const s of stats) {
    passYards += s.passYards || 0;
    rushYards += s.rushYards || 0;
    turnovers += (s.interceptions || 0) + (s.fumblesLost || 0);
    completions += s.completions || 0;
    passAttempts += s.passAttempts || 0;
    passTds += s.passTds || 0;
    carries += s.carries || 0;
    rushTds += s.rushTds || 0;
    receptions += s.receptions || 0;
    recTds += s.recTds || 0;
    sacks += s.sacks || 0;
    sackYards += s.sackYards || 0;
  }

  return {
    passYards,
    rushYards,
    totalYards: passYards + rushYards,
    turnovers,
    completions,
    passAttempts,
    passTds,
    carries,
    rushTds,
    receptions,
    recTds,
    sacks,
    sackYards,
  };
}

/* ------------------------------------------------------------------ */
/*  Game type label                                                    */
/* ------------------------------------------------------------------ */
function gameTypeLabel(gameType: string | null | undefined, week: number | null | undefined): string {
  if (!gameType) return `Week ${week ?? "?"}`;
  switch (gameType) {
    case "REG":
      return `Week ${week ?? "?"}`;
    case "WC":
      return "Wild Card";
    case "DIV":
      return "Divisional";
    case "CON":
      return "Conference Championship";
    case "SB":
      return "Super Bowl";
    case "POST":
      return `Postseason Week ${week ?? "?"}`;
    default:
      return gameType;
  }
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default async function NFLGamePage({ params }: Props) {
  const { gameId } = await params;
  const data = await getGameData(gameId);

  if (!data) notFound();

  const { game, awayTeamInfo, homeTeamInfo, awayStats, homeStats } = data;

  const awayName = awayTeamInfo
    ? `${awayTeamInfo.teamName || ""} ${awayTeamInfo.teamNick || ""}`.trim()
    : game.awayTeam || "Away";
  const homeName = homeTeamInfo
    ? `${homeTeamInfo.teamName || ""} ${homeTeamInfo.teamNick || ""}`.trim()
    : game.homeTeam || "Home";

  const awayAgg = aggregateTeamStats(awayStats);
  const homeAgg = aggregateTeamStats(homeStats);

  // Filter players by stat category
  const awayPassers = awayStats
    .filter((s) => (s.passAttempts || 0) > 0)
    .sort((a, b) => (b.passYards || 0) - (a.passYards || 0));
  const homePassers = homeStats
    .filter((s) => (s.passAttempts || 0) > 0)
    .sort((a, b) => (b.passYards || 0) - (a.passYards || 0));
  const awayRushers = awayStats
    .filter((s) => (s.carries || 0) > 0)
    .sort((a, b) => (b.rushYards || 0) - (a.rushYards || 0));
  const homeRushers = homeStats
    .filter((s) => (s.carries || 0) > 0)
    .sort((a, b) => (b.rushYards || 0) - (a.rushYards || 0));
  const awayReceivers = awayStats
    .filter((s) => (s.targets || 0) > 0 || (s.receptions || 0) > 0)
    .sort((a, b) => (b.recYards || 0) - (a.recYards || 0));
  const homeReceivers = homeStats
    .filter((s) => (s.targets || 0) > 0 || (s.receptions || 0) > 0)
    .sort((a, b) => (b.recYards || 0) - (a.recYards || 0));

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
          href={`/football/seasons/${game.season}`}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {game.season}
        </Link>
        <span className="text-xs text-muted-light">/</span>
        <span className="text-xs text-muted">Game</span>
      </div>

      {/* ============================================================ */}
      {/*  Score Header                                                 */}
      {/* ============================================================ */}
      <section className="mb-10">
        <div className="border border-border rounded-lg bg-surface p-6">
          {/* Meta info */}
          <p className="text-xs text-muted uppercase tracking-wider mb-4 text-center">
            {game.season} {gameTypeLabel(game.gameType, game.week)}
            {game.gameday && <span className="ml-2">&mdash; {game.gameday}</span>}
            {game.stadium && (
              <span className="ml-2">&mdash; {game.stadium}</span>
            )}
          </p>

          {/* Score display */}
          <div className="flex items-center justify-center gap-8 md:gap-16">
            {/* Away team */}
            <div className="flex flex-col items-center gap-2">
              {awayTeamInfo?.teamLogo && (
                <img
                  src={awayTeamInfo.teamLogo}
                  alt={game.awayTeam || ""}
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain"
                />
              )}
              <Link
                href={`/football/teams/${game.awayTeam}/${game.season}`}
                className={`text-sm font-medium ${LINK_CLASSES}`}
              >
                {awayName}
              </Link>
            </div>

            {/* Score */}
            <div className="flex items-baseline gap-4">
              <span className="text-5xl md:text-6xl font-semibold tracking-tighter font-mono">
                {game.awayScore ?? 0}
              </span>
              <span className="text-2xl text-muted font-light">&ndash;</span>
              <span className="text-5xl md:text-6xl font-semibold tracking-tighter font-mono">
                {game.homeScore ?? 0}
              </span>
            </div>

            {/* Home team */}
            <div className="flex flex-col items-center gap-2">
              {homeTeamInfo?.teamLogo && (
                <img
                  src={homeTeamInfo.teamLogo}
                  alt={game.homeTeam || ""}
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain"
                />
              )}
              <Link
                href={`/football/teams/${game.homeTeam}/${game.season}`}
                className={`text-sm font-medium ${LINK_CLASSES}`}
              >
                {homeName}
              </Link>
            </div>
          </div>

          {/* Final label */}
          <p className="text-center text-xs text-muted mt-3 uppercase tracking-wider">
            Final
            {game.overtime && " (OT)"}
          </p>

          {/* Coaches */}
          {(game.awayCoach || game.homeCoach) && (
            <div className="flex justify-center gap-8 mt-3 text-xs text-muted">
              {game.awayCoach && (
                <span>{game.awayTeam}: {game.awayCoach}</span>
              )}
              {game.homeCoach && (
                <span>{game.homeTeam}: {game.homeCoach}</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Team Stats Comparison                                        */}
      {/* ============================================================ */}
      {(awayStats.length > 0 || homeStats.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Team Stats
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={TH_LEFT}>Stat</th>
                    <th className={TH_RIGHT}>{game.awayTeam}</th>
                    <th className={TH_RIGHT}>{game.homeTeam}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {[
                    {
                      label: "Total Yards",
                      away: awayAgg.totalYards,
                      home: homeAgg.totalYards,
                    },
                    {
                      label: "Passing Yards",
                      away: awayAgg.passYards,
                      home: homeAgg.passYards,
                    },
                    {
                      label: "Comp/Att",
                      away: `${awayAgg.completions}/${awayAgg.passAttempts}`,
                      home: `${homeAgg.completions}/${homeAgg.passAttempts}`,
                      isString: true,
                    },
                    {
                      label: "Rushing Yards",
                      away: awayAgg.rushYards,
                      home: homeAgg.rushYards,
                    },
                    {
                      label: "Rush Attempts",
                      away: awayAgg.carries,
                      home: homeAgg.carries,
                    },
                    {
                      label: "Sacks",
                      away: awayAgg.sacks,
                      home: homeAgg.sacks,
                    },
                    {
                      label: "Turnovers",
                      away: awayAgg.turnovers,
                      home: homeAgg.turnovers,
                    },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className={TD_LEFT}>{row.label}</td>
                      <td className={TD_RIGHT_BOLD}>
                        {"isString" in row ? (row.away as string) : fmtInt(row.away as number)}
                      </td>
                      <td className={TD_RIGHT_BOLD}>
                        {"isString" in row ? (row.home as string) : fmtInt(row.home as number)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  Passing Stats                                                */}
      {/* ============================================================ */}
      {(awayPassers.length > 0 || homePassers.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Passing
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[
              {
                team: game.awayTeam,
                teamInfo: awayTeamInfo,
                players: awayPassers,
              },
              {
                team: game.homeTeam,
                teamInfo: homeTeamInfo,
                players: homePassers,
              },
            ].map(({ team, teamInfo, players }) =>
              players.length > 0 ? (
                <div
                  key={team}
                  className="border border-border rounded-lg overflow-hidden bg-surface"
                >
                  <div className="px-4 py-3 border-b border-border bg-surface-alt flex items-center gap-2">
                    {teamInfo?.teamLogo && (
                      <img
                        src={teamInfo.teamLogo}
                        alt={team || ""}
                        width={20}
                        height={20}
                        className="w-5 h-5 object-contain"
                      />
                    )}
                    <h3 className="text-sm font-medium">{team}</h3>
                  </div>
                  <div className="stat-scroll overflow-x-auto">
                    <table className="stat-table w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className={STICKY_TH}>Player</th>
                          {["C/A", "Yds", "TD", "INT", "Sck", "Rating"].map(
                            (col) => (
                              <th key={col} className={TH_RIGHT}>
                                {col}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {players.map((s) => {
                          const rating = passerRating(
                            s.completions || 0,
                            s.passAttempts || 0,
                            s.passYards || 0,
                            s.passTds || 0,
                            s.interceptions || 0
                          );
                          return (
                            <tr key={s.id}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/players/${s.player.id}`}
                                  className={LINK_CLASSES}
                                >
                                  {s.player.displayName ||
                                    `${s.player.firstName} ${s.player.lastName}`}
                                </Link>
                              </td>
                              <td className={TD_RIGHT}>
                                {s.completions || 0}/{s.passAttempts || 0}
                              </td>
                              <td className={TD_RIGHT_BOLD}>
                                {fmtInt(s.passYards || 0)}
                              </td>
                              <td className={TD_RIGHT_BOLD}>
                                {s.passTds || 0}
                              </td>
                              <td className={TD_RIGHT}>{s.interceptions || 0}</td>
                              <td className={TD_RIGHT}>{s.sacks || 0}</td>
                              <td className={TD_RIGHT}>
                                {rating !== null ? rating.toFixed(1) : "\u2014"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null
            )}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  Rushing Stats                                                */}
      {/* ============================================================ */}
      {(awayRushers.length > 0 || homeRushers.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Rushing
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[
              {
                team: game.awayTeam,
                teamInfo: awayTeamInfo,
                players: awayRushers,
              },
              {
                team: game.homeTeam,
                teamInfo: homeTeamInfo,
                players: homeRushers,
              },
            ].map(({ team, teamInfo, players }) =>
              players.length > 0 ? (
                <div
                  key={team}
                  className="border border-border rounded-lg overflow-hidden bg-surface"
                >
                  <div className="px-4 py-3 border-b border-border bg-surface-alt flex items-center gap-2">
                    {teamInfo?.teamLogo && (
                      <img
                        src={teamInfo.teamLogo}
                        alt={team || ""}
                        width={20}
                        height={20}
                        className="w-5 h-5 object-contain"
                      />
                    )}
                    <h3 className="text-sm font-medium">{team}</h3>
                  </div>
                  <div className="stat-scroll overflow-x-auto">
                    <table className="stat-table w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className={STICKY_TH}>Player</th>
                          {["Car", "Yds", "Y/A", "TD", "Fum"].map((col) => (
                            <th key={col} className={TH_RIGHT}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {players.map((s) => {
                          const car = s.carries || 0;
                          const ya =
                            car > 0
                              ? ((s.rushYards || 0) / car).toFixed(1)
                              : "\u2014";
                          return (
                            <tr key={s.id}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/players/${s.player.id}`}
                                  className={LINK_CLASSES}
                                >
                                  {s.player.displayName ||
                                    `${s.player.firstName} ${s.player.lastName}`}
                                </Link>
                              </td>
                              <td className={TD_RIGHT}>{car}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {fmtInt(s.rushYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{ya}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {s.rushTds || 0}
                              </td>
                              <td className={TD_RIGHT}>{s.fumbles || 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null
            )}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  Receiving Stats                                              */}
      {/* ============================================================ */}
      {(awayReceivers.length > 0 || homeReceivers.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Receiving
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[
              {
                team: game.awayTeam,
                teamInfo: awayTeamInfo,
                players: awayReceivers,
              },
              {
                team: game.homeTeam,
                teamInfo: homeTeamInfo,
                players: homeReceivers,
              },
            ].map(({ team, teamInfo, players }) =>
              players.length > 0 ? (
                <div
                  key={team}
                  className="border border-border rounded-lg overflow-hidden bg-surface"
                >
                  <div className="px-4 py-3 border-b border-border bg-surface-alt flex items-center gap-2">
                    {teamInfo?.teamLogo && (
                      <img
                        src={teamInfo.teamLogo}
                        alt={team || ""}
                        width={20}
                        height={20}
                        className="w-5 h-5 object-contain"
                      />
                    )}
                    <h3 className="text-sm font-medium">{team}</h3>
                  </div>
                  <div className="stat-scroll overflow-x-auto">
                    <table className="stat-table w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className={STICKY_TH}>Player</th>
                          {["Tgt", "Rec", "Yds", "Y/R", "TD"].map((col) => (
                            <th key={col} className={TH_RIGHT}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {players.map((s) => {
                          const rec = s.receptions || 0;
                          const yr =
                            rec > 0
                              ? ((s.recYards || 0) / rec).toFixed(1)
                              : "\u2014";
                          return (
                            <tr key={s.id}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/players/${s.player.id}`}
                                  className={LINK_CLASSES}
                                >
                                  {s.player.displayName ||
                                    `${s.player.firstName} ${s.player.lastName}`}
                                </Link>
                              </td>
                              <td className={TD_RIGHT}>{s.targets || 0}</td>
                              <td className={TD_RIGHT_BOLD}>{rec}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {fmtInt(s.recYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{yr}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {s.recTds || 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null
            )}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  Game Info                                                    */}
      {/* ============================================================ */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Game Info
        </h2>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="px-4 py-3 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {game.stadium && (
              <div>
                <span className="text-xs text-muted uppercase tracking-wider">
                  Stadium
                </span>
                <p className="mt-0.5">{game.stadium}</p>
              </div>
            )}
            {game.surface && (
              <div>
                <span className="text-xs text-muted uppercase tracking-wider">
                  Surface
                </span>
                <p className="mt-0.5 capitalize">{game.surface}</p>
              </div>
            )}
            {game.roof && (
              <div>
                <span className="text-xs text-muted uppercase tracking-wider">
                  Roof
                </span>
                <p className="mt-0.5 capitalize">{game.roof}</p>
              </div>
            )}
            {game.awayCoach && (
              <div>
                <span className="text-xs text-muted uppercase tracking-wider">
                  {game.awayTeam} Coach
                </span>
                <p className="mt-0.5">{game.awayCoach}</p>
              </div>
            )}
            {game.homeCoach && (
              <div>
                <span className="text-xs text-muted uppercase tracking-wider">
                  {game.homeTeam} Coach
                </span>
                <p className="mt-0.5">{game.homeCoach}</p>
              </div>
            )}
            {game.gameday && (
              <div>
                <span className="text-xs text-muted uppercase tracking-wider">
                  Game Day
                </span>
                <p className="mt-0.5">{game.gameday}</p>
              </div>
            )}
            {game.weekday && (
              <div>
                <span className="text-xs text-muted uppercase tracking-wider">
                  Day of Week
                </span>
                <p className="mt-0.5">{game.weekday}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Empty state for stats */}
      {awayStats.length === 0 && homeStats.length === 0 && (
        <div className="border border-border rounded-lg bg-surface p-8 text-center">
          <p className="text-muted">
            No individual player stats available for this game.
          </p>
        </div>
      )}
    </div>
  );
}
