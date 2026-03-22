import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { fmtInt } from "@/lib/format";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TH_LEFT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left";
const TH_RIGHT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-right";
const TH_CENTER =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-center";
const TD_LEFT = "py-2 px-2.5 text-left text-sm";
const TD_RIGHT = "py-2 px-2.5 text-right font-mono text-xs";
const TD_RIGHT_BOLD = "py-2 px-2.5 text-right font-mono text-xs font-medium";
const TD_CENTER = "py-2 px-2.5 text-center font-mono text-xs";
const LINK_CLASSES =
  "text-link hover:text-link-hover hover:underline transition-colors";

/* ------------------------------------------------------------------ */
/*  Retrosheet team code -> display name mapping                       */
/* ------------------------------------------------------------------ */
const RETRO_DISPLAY: Record<string, string> = {
  ANA: "Angels", ARI: "D-backs", ATL: "Braves", BAL: "Orioles",
  BOS: "Red Sox", CHA: "White Sox", CHN: "Cubs", CIN: "Reds",
  CLE: "Guardians", COL: "Rockies", DET: "Tigers", FLO: "Marlins",
  HOU: "Astros", KCA: "Royals", LAN: "Dodgers", MIA: "Marlins",
  MIL: "Brewers", MIN: "Twins", MON: "Expos", NYA: "Yankees",
  NYN: "Mets", OAK: "Athletics", PHI: "Phillies", PIT: "Pirates",
  SDN: "Padres", SEA: "Mariners", SFN: "Giants", SLN: "Cardinals",
  TBA: "Rays", TEX: "Rangers", TOR: "Blue Jays", WAS: "Nationals",
  WSN: "Nationals",
};

/* Map Retrosheet codes to Lahman teamIDs for links */
const RETRO_TO_LAHMAN: Record<string, string> = {
  ANA: "LAA", ARI: "ARI", ATL: "ATL", BAL: "BAL",
  BOS: "BOS", CHA: "CHA", CHN: "CHN", CIN: "CIN",
  CLE: "CLE", COL: "COL", DET: "DET", FLO: "FLO",
  HOU: "HOU", KCA: "KCA", LAN: "LAN", MIA: "MIA",
  MIL: "MIL", MIN: "MIN", MON: "MON", NYA: "NYA",
  NYN: "NYN", OAK: "OAK", PHI: "PHI", PIT: "PIT",
  SDN: "SDN", SEA: "SEA", SFN: "SFN", SLN: "SLN",
  TBA: "TBA", TEX: "TEX", TOR: "TOR", WAS: "WAS",
  WSN: "WAS",
};

/* ------------------------------------------------------------------ */
/*  Line score parser                                                  */
/*  Each character is runs for that inning. "(10)" means 10 runs.      */
/* ------------------------------------------------------------------ */
function parseLineScore(line: string | null | undefined): number[] {
  if (!line) return [];
  const innings: number[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "(") {
      const close = line.indexOf(")", i);
      if (close === -1) break;
      innings.push(parseInt(line.slice(i + 1, close), 10));
      i = close + 1;
    } else if (line[i] === "x") {
      innings.push(-1); // did not bat
      i++;
    } else {
      innings.push(parseInt(line[i], 10));
      i++;
    }
  }
  return innings;
}

/* ------------------------------------------------------------------ */
/*  Lineup player type                                                 */
/* ------------------------------------------------------------------ */
interface LineupPlayer {
  id: string;
  name: string;
  pos: string;
}

function parseLineup(json: string | null | undefined): LineupPlayer[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as LineupPlayer[];
  } catch {
    return [];
  }
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
  const game = await getGame(gameId);
  if (!game) return { title: "Game Not Found" };
  const dateStr = formatDate(game.date);
  const away = RETRO_DISPLAY[game.visitingTeam || ""] || game.visitingTeam || "Away";
  const home = RETRO_DISPLAY[game.homeTeam || ""] || game.homeTeam || "Home";
  return {
    title: `${away} ${game.visitingScore ?? 0} @ ${home} ${game.homeScore ?? 0} - ${dateStr}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */
function formatDate(dateStr: string): string {
  if (dateStr.length === 8) {
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    return `${m}/${d}/${y}`;
  }
  return dateStr;
}

function formatDateLong(dateStr: string): string {
  if (dateStr.length === 8) {
    const y = parseInt(dateStr.slice(0, 4));
    const m = parseInt(dateStr.slice(4, 6)) - 1;
    const d = parseInt(dateStr.slice(6, 8));
    const date = new Date(y, m, d);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return dateStr;
}

async function getGame(gameId: string) {
  // Support both numeric IDs and date-away-home format (e.g. "20241030-LAN-NYA")
  const id = parseInt(gameId, 10);
  if (!isNaN(id) && String(id) === gameId) {
    return prisma.gameLog.findUnique({ where: { id } });
  }

  // Parse date-away-home format
  const parts = gameId.split("-");
  if (parts.length >= 3) {
    const date = parts[0];
    const visitingTeam = parts[1];
    const homeTeam = parts[2];
    return prisma.gameLog.findFirst({
      where: { date, visitingTeam, homeTeam },
    });
  }

  return null;
}

function formatTimeOfGame(minutes: number | null | undefined): string {
  if (!minutes) return "\u2014";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function retroPlayerLink(retroId: string | null | undefined): string | null {
  if (!retroId) return null;
  // Retrosheet IDs typically map to Lahman playerIDs via retroID field
  // We link to a search or the player page directly
  return `/baseball/players/${retroId}`;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default async function MLBGamePage({ params }: Props) {
  const { gameId } = await params;
  const game = await getGame(gameId);

  if (!game) notFound();

  const awayCode = game.visitingTeam || "???";
  const homeCode = game.homeTeam || "???";
  const awayName = RETRO_DISPLAY[awayCode] || awayCode;
  const homeName = RETRO_DISPLAY[homeCode] || homeCode;
  const awayLahman = RETRO_TO_LAHMAN[awayCode] || awayCode;
  const homeLahman = RETRO_TO_LAHMAN[homeCode] || homeCode;
  const year = game.date.length >= 4 ? game.date.slice(0, 4) : "";

  // Parse line scores
  const awayLine = parseLineScore(game.visitingLine);
  const homeLine = parseLineScore(game.homeLine);
  const maxInnings = Math.max(awayLine.length, homeLine.length, 9);

  // Parse lineups
  const awayLineup = parseLineup(game.vLineup);
  const homeLineup = parseLineup(game.hLineup);

  // Look up park name
  const park = game.parkID
    ? await prisma.parks.findUnique({
        where: { parkKey: game.parkID },
        select: { parkName: true, city: true, state: true },
      })
    : null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/baseball"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          Baseball
        </Link>
        <span className="text-xs text-muted-light">/</span>
        <span className="text-xs text-muted">Game</span>
      </div>

      {/* ============================================================ */}
      {/*  Box Score Header                                             */}
      {/* ============================================================ */}
      <section className="mb-10">
        <div className="border border-border rounded-lg bg-surface p-6">
          {/* Date & venue info */}
          <p className="text-xs text-muted uppercase tracking-wider mb-4">
            {formatDateLong(game.date)}
            {game.dayNight && (
              <span className="ml-2">
                {game.dayNight === "N" ? "Night" : "Day"}
              </span>
            )}
            {park?.parkName && (
              <span className="ml-2">
                &mdash; {park.parkName}
                {park.city && `, ${park.city}`}
                {park.state && `, ${park.state}`}
              </span>
            )}
            {game.attendance && (
              <span className="ml-2">
                &mdash; Att: {fmtInt(game.attendance)}
              </span>
            )}
          </p>

          {/* Score display */}
          <div className="flex items-center justify-center gap-8 md:gap-16">
            {/* Away team */}
            <div className="flex flex-col items-center gap-2">
              <TeamLogo teamID={awayLahman} size={48} />
              <Link
                href={`/baseball/teams/${awayLahman}/${year}`}
                className={`text-sm font-medium ${LINK_CLASSES}`}
              >
                {awayName}
              </Link>
              <span className="text-xs text-muted uppercase tracking-wider">
                {awayCode}
              </span>
            </div>

            {/* Score */}
            <div className="flex items-baseline gap-4">
              <span className="text-5xl md:text-6xl font-semibold tracking-tighter font-mono">
                {game.visitingScore ?? 0}
              </span>
              <span className="text-2xl text-muted font-light">&ndash;</span>
              <span className="text-5xl md:text-6xl font-semibold tracking-tighter font-mono">
                {game.homeScore ?? 0}
              </span>
            </div>

            {/* Home team */}
            <div className="flex flex-col items-center gap-2">
              <TeamLogo teamID={homeLahman} size={48} />
              <Link
                href={`/baseball/teams/${homeLahman}/${year}`}
                className={`text-sm font-medium ${LINK_CLASSES}`}
              >
                {homeName}
              </Link>
              <span className="text-xs text-muted uppercase tracking-wider">
                {homeCode}
              </span>
            </div>
          </div>

          {/* Final label */}
          <p className="text-center text-xs text-muted mt-3 uppercase tracking-wider">
            Final
            {maxInnings > 9 && ` (${maxInnings} innings)`}
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Line Score                                                   */}
      {/* ============================================================ */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Line Score
        </h2>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="stat-scroll overflow-x-auto">
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH_LEFT}>Team</th>
                  {Array.from({ length: maxInnings }, (_, i) => (
                    <th key={i} className={TH_CENTER}>
                      {i + 1}
                    </th>
                  ))}
                  <th className={`${TH_CENTER} border-l border-border font-semibold`}>R</th>
                  <th className={TH_CENTER}>H</th>
                  <th className={TH_CENTER}>E</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {/* Away */}
                <tr>
                  <td className={TD_LEFT}>
                    <span className="font-medium">{awayCode}</span>
                  </td>
                  {Array.from({ length: maxInnings }, (_, i) => (
                    <td key={i} className={TD_CENTER}>
                      {i < awayLine.length
                        ? awayLine[i] === -1
                          ? ""
                          : awayLine[i]
                        : ""}
                    </td>
                  ))}
                  <td className={`${TD_CENTER} border-l border-border font-semibold`}>
                    {game.visitingScore ?? 0}
                  </td>
                  <td className={TD_CENTER}>{game.vH ?? 0}</td>
                  <td className={TD_CENTER}>{game.vE ?? 0}</td>
                </tr>
                {/* Home */}
                <tr>
                  <td className={TD_LEFT}>
                    <span className="font-medium">{homeCode}</span>
                  </td>
                  {Array.from({ length: maxInnings }, (_, i) => (
                    <td key={i} className={TD_CENTER}>
                      {i < homeLine.length
                        ? homeLine[i] === -1
                          ? "x"
                          : homeLine[i]
                        : ""}
                    </td>
                  ))}
                  <td className={`${TD_CENTER} border-l border-border font-semibold`}>
                    {game.homeScore ?? 0}
                  </td>
                  <td className={TD_CENTER}>{game.hH ?? 0}</td>
                  <td className={TD_CENTER}>{game.hE ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Team Stats Comparison                                        */}
      {/* ============================================================ */}
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
                  <th className={TH_RIGHT}>{awayCode}</th>
                  <th className={TH_RIGHT}>{homeCode}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {[
                  { label: "At Bats", away: game.vAB, home: game.hAB },
                  { label: "Hits", away: game.vH, home: game.hH },
                  { label: "Doubles", away: game.v2B, home: game.h2B },
                  { label: "Triples", away: game.v3B, home: game.h3B },
                  { label: "Home Runs", away: game.vHR, home: game.hHR },
                  { label: "RBI", away: game.vRBI, home: game.hRBI },
                  { label: "Walks", away: game.vBB, home: game.hBB },
                  { label: "Strikeouts", away: game.vSO, home: game.hSO },
                  { label: "Stolen Bases", away: game.vSB, home: game.hSB },
                  { label: "Caught Stealing", away: game.vCS, home: game.hCS },
                  { label: "Errors", away: game.vE, home: game.hE },
                  { label: "Double Plays", away: game.vDP, home: game.hDP },
                  { label: "Left on Base", away: game.vLOB, home: game.hLOB },
                  { label: "Hit By Pitch", away: game.vHBP, home: game.hHBP },
                  { label: "Sacrifice Hits", away: game.vSH, home: game.hSH },
                  { label: "Sacrifice Flies", away: game.vSF, home: game.hSF },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className={TD_LEFT}>{row.label}</td>
                    <td className={TD_RIGHT_BOLD}>{row.away ?? 0}</td>
                    <td className={TD_RIGHT_BOLD}>{row.home ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Starting Lineups                                             */}
      {/* ============================================================ */}
      {(awayLineup.length > 0 || homeLineup.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Starting Lineups
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Away lineup */}
            {awayLineup.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="px-4 py-3 border-b border-border bg-surface-alt">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <TeamLogo teamID={awayLahman} size={20} />
                    {awayName}
                  </h3>
                </div>
                <table className="stat-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={`${TH_CENTER} w-10`}>#</th>
                      <th className={TH_LEFT}>Player</th>
                      <th className={TH_CENTER}>Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {awayLineup.map((p, i) => (
                      <tr key={`${p.id}-${i}`}>
                        <td className={TD_CENTER}>{i + 1}</td>
                        <td className={TD_LEFT}>
                          <span className="font-medium">{p.name}</span>
                        </td>
                        <td className={TD_CENTER}>{p.pos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Home lineup */}
            {homeLineup.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="px-4 py-3 border-b border-border bg-surface-alt">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <TeamLogo teamID={homeLahman} size={20} />
                    {homeName}
                  </h3>
                </div>
                <table className="stat-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={`${TH_CENTER} w-10`}>#</th>
                      <th className={TH_LEFT}>Player</th>
                      <th className={TH_CENTER}>Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {homeLineup.map((p, i) => (
                      <tr key={`${p.id}-${i}`}>
                        <td className={TD_CENTER}>{i + 1}</td>
                        <td className={TD_LEFT}>
                          <span className="font-medium">{p.name}</span>
                        </td>
                        <td className={TD_CENTER}>{p.pos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  Pitching                                                     */}
      {/* ============================================================ */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Pitching
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Starting Pitchers */}
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="px-4 py-3 border-b border-border bg-surface-alt">
              <h3 className="text-sm font-medium">Starting Pitchers</h3>
            </div>
            <div className="divide-y divide-border-light">
              <div className="flex items-center px-4 py-3">
                <span className="w-16 text-xs text-muted">{awayCode}</span>
                <span className="font-medium text-sm">
                  {game.vStartPName || "\u2014"}
                </span>
              </div>
              <div className="flex items-center px-4 py-3">
                <span className="w-16 text-xs text-muted">{homeCode}</span>
                <span className="font-medium text-sm">
                  {game.hStartPName || "\u2014"}
                </span>
              </div>
            </div>
          </div>

          {/* Decision */}
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="px-4 py-3 border-b border-border bg-surface-alt">
              <h3 className="text-sm font-medium">Decision</h3>
            </div>
            <div className="divide-y divide-border-light">
              {game.wpName && (
                <div className="flex items-center px-4 py-3">
                  <span className="w-10 text-xs font-medium text-green-600 dark:text-green-400">
                    W
                  </span>
                  <span className="font-medium text-sm">{game.wpName}</span>
                </div>
              )}
              {game.lpName && (
                <div className="flex items-center px-4 py-3">
                  <span className="w-10 text-xs font-medium text-red-500">
                    L
                  </span>
                  <span className="font-medium text-sm">{game.lpName}</span>
                </div>
              )}
              {game.svName && (
                <div className="flex items-center px-4 py-3">
                  <span className="w-10 text-xs font-medium text-blue-500">
                    SV
                  </span>
                  <span className="font-medium text-sm">{game.svName}</span>
                </div>
              )}
              {!game.wpName && !game.lpName && !game.svName && (
                <div className="px-4 py-3 text-sm text-muted">
                  No pitching decision data available
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Game Info                                                    */}
      {/* ============================================================ */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Game Info
        </h2>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="divide-y divide-border-light">
            {/* Umpires */}
            {(game.hpUmpireName ||
              game.firstBUmpireName ||
              game.secondBUmpireName ||
              game.thirdBUmpireName) && (
              <div className="px-4 py-3">
                <span className="text-xs text-muted uppercase tracking-wider">
                  Umpires
                </span>
                <div className="mt-1 text-sm flex flex-wrap gap-x-6 gap-y-1">
                  {game.hpUmpireName && (
                    <span>
                      <span className="text-muted text-xs">HP</span>{" "}
                      {game.hpUmpireName}
                    </span>
                  )}
                  {game.firstBUmpireName && (
                    <span>
                      <span className="text-muted text-xs">1B</span>{" "}
                      {game.firstBUmpireName}
                    </span>
                  )}
                  {game.secondBUmpireName && (
                    <span>
                      <span className="text-muted text-xs">2B</span>{" "}
                      {game.secondBUmpireName}
                    </span>
                  )}
                  {game.thirdBUmpireName && (
                    <span>
                      <span className="text-muted text-xs">3B</span>{" "}
                      {game.thirdBUmpireName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Managers */}
            {(game.vManagerName || game.hManagerName) && (
              <div className="px-4 py-3">
                <span className="text-xs text-muted uppercase tracking-wider">
                  Managers
                </span>
                <div className="mt-1 text-sm flex flex-wrap gap-x-6 gap-y-1">
                  {game.vManagerName && (
                    <span>
                      <span className="text-muted text-xs">{awayCode}</span>{" "}
                      {game.vManagerName}
                    </span>
                  )}
                  {game.hManagerName && (
                    <span>
                      <span className="text-muted text-xs">{homeCode}</span>{" "}
                      {game.hManagerName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Time, Park, Attendance */}
            <div className="px-4 py-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {game.timeOfGame && (
                <div>
                  <span className="text-xs text-muted uppercase tracking-wider">
                    Time of Game
                  </span>
                  <p className="font-mono mt-0.5">
                    {formatTimeOfGame(game.timeOfGame)}
                  </p>
                </div>
              )}
              {game.dayNight && (
                <div>
                  <span className="text-xs text-muted uppercase tracking-wider">
                    Day/Night
                  </span>
                  <p className="mt-0.5">
                    {game.dayNight === "N" ? "Night" : "Day"}
                  </p>
                </div>
              )}
              {park?.parkName && (
                <div>
                  <span className="text-xs text-muted uppercase tracking-wider">
                    Park
                  </span>
                  <p className="mt-0.5">{park.parkName}</p>
                </div>
              )}
              {game.attendance && (
                <div>
                  <span className="text-xs text-muted uppercase tracking-wider">
                    Attendance
                  </span>
                  <p className="font-mono mt-0.5">{fmtInt(game.attendance)}</p>
                </div>
              )}
              {game.lengthOuts && (
                <div>
                  <span className="text-xs text-muted uppercase tracking-wider">
                    Length (Outs)
                  </span>
                  <p className="font-mono mt-0.5">{game.lengthOuts}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
