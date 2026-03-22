import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { fmtInt, ordinal } from "@/lib/format";
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
  "py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface";

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

function formatHeight(h: string | null): string {
  if (!h) return "\u2014";
  // height might be stored as "6-2" or "6'2" or "74" (inches)
  if (h.includes("-")) {
    const [ft, inches] = h.split("-");
    return `${ft}'${inches}"`;
  }
  if (h.includes("'")) return h;
  const total = parseInt(h);
  if (isNaN(total)) return h;
  return `${Math.floor(total / 12)}'${total % 12}"`;
}

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  ) {
    age--;
  }
  return age;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  params: Promise<{ id: string }>;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const player = await prisma.nFLPlayer.findUnique({
    where: { id },
    select: { displayName: true, firstName: true, lastName: true },
  });
  if (!player) return { title: "Player Not Found" };
  return { title: player.displayName || `${player.firstName} ${player.lastName}` };
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */
async function getPlayerData(id: string) {
  const player = await prisma.nFLPlayer.findUnique({
    where: { id },
  });

  if (!player) return null;

  const [stats, team] = await Promise.all([
    prisma.nFLPlayerStats.findMany({
      where: { playerId: id, seasonType: "REG" },
      orderBy: [{ season: "asc" }],
    }),
    player.latestTeam
      ? prisma.nFLTeam.findUnique({ where: { teamAbbr: player.latestTeam } })
      : null,
  ]);

  return { player, stats, team };
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default async function NFLPlayerPage({ params }: Props) {
  const { id } = await params;
  const data = await getPlayerData(id);

  if (!data) notFound();

  const { player, stats, team } = data;

  const name =
    player.displayName ||
    [player.firstName, player.lastName, player.suffix].filter(Boolean).join(" ");
  const pos = player.position || "Unknown";
  const posGroup = player.positionGroup || pos;
  const age = computeAge(player.birthDate);

  // Determine primary stat display based on position
  const isQB = pos === "QB";
  const isRB = pos === "RB" || pos === "FB";
  const isWRTE = pos === "WR" || pos === "TE";

  // Career totals
  const career = stats.reduce(
    (acc, s) => ({
      games: acc.games + (s.games || 0),
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
      fumblesLost: acc.fumblesLost + (s.fumblesLost || 0),
    }),
    {
      games: 0,
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
      fumblesLost: 0,
    }
  );

  const careerRating = passerRating(
    career.completions,
    career.passAttempts,
    career.passYards,
    career.passTds,
    career.interceptions
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
        <span className="text-xs text-muted">Players</span>
        <span className="text-xs text-muted-light">/</span>
      </div>

      {/* Player Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-10">
        {/* Headshot */}
        <div className="flex-shrink-0">
          {player.headshot ? (
            <img
              src={player.headshot}
              alt={name}
              width={128}
              height={128}
              className="w-32 h-32 rounded-lg object-cover bg-surface-alt"
              
           />
          ) : (
            <div className="w-32 h-32 rounded-lg bg-surface-alt flex items-center justify-center">
              <span className="text-4xl text-muted-light">
                {(player.firstName?.[0] || "") + (player.lastName?.[0] || "")}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
            {name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted">
            <span className="font-medium text-foreground">{pos}</span>
            {player.jerseyNumber !== null && (
              <span className="font-mono">#{player.jerseyNumber}</span>
            )}
            {team && (
              <Link
                href={`/football/teams/${team.teamAbbr}`}
                className={LINK_CLASSES}
              >
                {team.teamName}
              </Link>
            )}
            {player.status && <span>{player.status}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted">
            {player.height && <span>{formatHeight(player.height)}</span>}
            {player.weight && <span>{player.weight} lbs</span>}
            {player.birthDate && (
              <span>
                Born {player.birthDate}
                {age !== null && ` (age ${age})`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted">
            {player.college && <span>{player.college}</span>}
            {player.draftYear && (
              <span>
                {player.draftYear} Draft: Rd {player.draftRound}, Pick{" "}
                {player.draftPick}
                {player.draftTeam && ` (${player.draftTeam})`}
              </span>
            )}
            {!player.draftYear && player.rookieSeason && (
              <span>Undrafted</span>
            )}
            {player.yearsExp !== null && player.yearsExp !== undefined && (
              <span>{player.yearsExp} years exp</span>
            )}
          </div>
        </div>
      </div>

      {/* Career Stat Cards */}
      <section className="mb-10 flex flex-wrap gap-8">
        <StatCard label="Games" value={fmtInt(career.games)}/>
        {isQB && (
          <>
            <StatCard
              label="Pass Yards"
              value={fmtInt(career.passYards)}
              sub={`${fmtInt(career.passTds)} TD / ${fmtInt(career.interceptions)} INT`}
           />
            <StatCard
              label="Comp %"
              value={
                career.passAttempts > 0
                  ? ((career.completions / career.passAttempts) * 100).toFixed(1) + "%"
                  : "\u2014"
              }
              sub={`${fmtInt(career.completions)}/${fmtInt(career.passAttempts)}`}
           />
            <StatCard
              label="Passer Rating"
              value={careerRating !== null ? careerRating.toFixed(1) : "\u2014"}
           />
            {career.rushYards > 0 && (
              <StatCard
                label="Rush Yards"
                value={fmtInt(career.rushYards)}
                sub={`${fmtInt(career.rushTds)} TD`}
             />
            )}
          </>
        )}
        {isRB && (
          <>
            <StatCard
              label="Rush Yards"
              value={fmtInt(career.rushYards)}
              sub={`${fmtInt(career.rushTds)} TD on ${fmtInt(career.carries)} carries`}
           />
            <StatCard
              label="Y/A"
              value={
                career.carries > 0
                  ? (career.rushYards / career.carries).toFixed(1)
                  : "\u2014"
              }
           />
            {career.receptions > 0 && (
              <StatCard
                label="Rec Yards"
                value={fmtInt(career.recYards)}
                sub={`${fmtInt(career.receptions)} rec / ${fmtInt(career.recTds)} TD`}
             />
            )}
          </>
        )}
        {isWRTE && (
          <>
            <StatCard
              label="Rec Yards"
              value={fmtInt(career.recYards)}
              sub={`${fmtInt(career.recTds)} TD`}
           />
            <StatCard
              label="Receptions"
              value={fmtInt(career.receptions)}
              sub={`${fmtInt(career.targets)} targets`}
           />
            <StatCard
              label="Y/R"
              value={
                career.receptions > 0
                  ? (career.recYards / career.receptions).toFixed(1)
                  : "\u2014"
              }
           />
            {career.rushYards > 0 && (
              <StatCard
                label="Rush Yards"
                value={fmtInt(career.rushYards)}
                sub={`${fmtInt(career.rushTds)} TD`}
             />
            )}
          </>
        )}
        {!isQB && !isRB && !isWRTE && (
          <>
            {career.passYards > 0 && (
              <StatCard label="Pass Yards" value={fmtInt(career.passYards)}/>
            )}
            {career.rushYards > 0 && (
              <StatCard label="Rush Yards" value={fmtInt(career.rushYards)}/>
            )}
            {career.recYards > 0 && (
              <StatCard label="Rec Yards" value={fmtInt(career.recYards)}/>
            )}
          </>
        )}
        {career.fumbles > 0 && (
          <StatCard
            label="Fumbles"
            value={fmtInt(career.fumbles)}
            sub={`${fmtInt(career.fumblesLost)} lost`}
         />
        )}
      </section>

      {/* Season-by-Season Stats */}
      {stats.length > 0 && (
        <section className="mb-10">
          {/* QB Stats Table */}
          {(isQB || career.passAttempts >= 100) && (
            <>
              <h2 className="text-lg font-semibold tracking-tight mb-4">
                Passing Stats
              </h2>
              <div className="border border-border rounded-lg overflow-hidden bg-surface mb-6">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={STICKY_TH}>Season</th>
                        {[
                          "Team",
                          "G",
                          "Comp",
                          "Att",
                          "Pct",
                          "Yds",
                          "TD",
                          "INT",
                          "Sacks",
                          "Rating",
                        ].map((col) => (
                          <th
                            key={col}
                            className={col === "Team" ? TH_LEFT : TH_RIGHT}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {stats
                        .filter(
                          (s) =>
                            (s.passAttempts || 0) > 0 ||
                            (isQB && (s.games || 0) > 0)
                        )
                        .map((s) => {
                          const cmp = s.completions || 0;
                          const att = s.passAttempts || 0;
                          const pct =
                            att > 0
                              ? ((cmp / att) * 100).toFixed(1)
                              : "\u2014";
                          const rating = passerRating(
                            cmp,
                            att,
                            s.passYards || 0,
                            s.passTds || 0,
                            s.interceptions || 0
                          );
                          return (
                            <tr key={`pass-${s.season}-${s.team}`}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/seasons/${s.season}`}
                                  className={LINK_CLASSES}
                                >
                                  {s.season}
                                </Link>
                              </td>
                              <td className={TD_LEFT}>
                                {s.team ? (
                                  <Link
                                    href={`/football/teams/${s.team}/${s.season}`}
                                    className={LINK_CLASSES}
                                  >
                                    {s.team}
                                  </Link>
                                ) : (
                                  "\u2014"
                                )}
                              </td>
                              <td className={TD_RIGHT}>{s.games || 0}</td>
                              <td className={TD_RIGHT}>{cmp}</td>
                              <td className={TD_RIGHT}>{att}</td>
                              <td className={TD_RIGHT}>{pct}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {fmtInt(s.passYards || 0)}
                              </td>
                              <td className={TD_RIGHT_BOLD}>
                                {s.passTds || 0}
                              </td>
                              <td className={TD_RIGHT}>{s.interceptions || 0}</td>
                              <td className={TD_RIGHT}>{s.sacks || 0}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {rating !== null ? rating.toFixed(1) : "\u2014"}
                              </td>
                            </tr>
                          );
                        })}
                      {/* Career totals row */}
                      {stats.filter((s) => (s.passAttempts || 0) > 0).length >
                        1 && (
                        <tr className="border-t-2 border-border font-medium bg-surface-alt">
                          <td className={STICKY_TD}>Career</td>
                          <td className={TD_LEFT}></td>
                          <td className={TD_RIGHT}>{career.games}</td>
                          <td className={TD_RIGHT}>{fmtInt(career.completions)}</td>
                          <td className={TD_RIGHT}>{fmtInt(career.passAttempts)}</td>
                          <td className={TD_RIGHT}>
                            {career.passAttempts > 0
                              ? (
                                  (career.completions / career.passAttempts) *
                                  100
                                ).toFixed(1)
                              : "\u2014"}
                          </td>
                          <td className={TD_RIGHT_BOLD}>
                            {fmtInt(career.passYards)}
                          </td>
                          <td className={TD_RIGHT_BOLD}>
                            {fmtInt(career.passTds)}
                          </td>
                          <td className={TD_RIGHT}>
                            {fmtInt(career.interceptions)}
                          </td>
                          <td className={TD_RIGHT}>{fmtInt(career.sacks)}</td>
                          <td className={TD_RIGHT_BOLD}>
                            {careerRating !== null
                              ? careerRating.toFixed(1)
                              : "\u2014"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Rushing Stats Table */}
          {(isRB || career.carries >= 20) && (
            <>
              <h2 className="text-lg font-semibold tracking-tight mb-4">
                Rushing Stats
              </h2>
              <div className="border border-border rounded-lg overflow-hidden bg-surface mb-6">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={STICKY_TH}>Season</th>
                        {[
                          "Team",
                          "G",
                          "Car",
                          "Yds",
                          "Y/A",
                          "TD",
                          "Rec",
                          "RecYds",
                          "RecTD",
                          "Fum",
                        ].map((col) => (
                          <th
                            key={col}
                            className={col === "Team" ? TH_LEFT : TH_RIGHT}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {stats
                        .filter(
                          (s) =>
                            (s.carries || 0) > 0 ||
                            (isRB && (s.games || 0) > 0)
                        )
                        .map((s) => {
                          const car = s.carries || 0;
                          const yds = s.rushYards || 0;
                          const ya =
                            car > 0 ? (yds / car).toFixed(1) : "\u2014";
                          return (
                            <tr key={`rush-${s.season}-${s.team}`}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/seasons/${s.season}`}
                                  className={LINK_CLASSES}
                                >
                                  {s.season}
                                </Link>
                              </td>
                              <td className={TD_LEFT}>
                                {s.team ? (
                                  <Link
                                    href={`/football/teams/${s.team}/${s.season}`}
                                    className={LINK_CLASSES}
                                  >
                                    {s.team}
                                  </Link>
                                ) : (
                                  "\u2014"
                                )}
                              </td>
                              <td className={TD_RIGHT}>{s.games || 0}</td>
                              <td className={TD_RIGHT}>{car}</td>
                              <td className={TD_RIGHT_BOLD}>{fmtInt(yds)}</td>
                              <td className={TD_RIGHT}>{ya}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {s.rushTds || 0}
                              </td>
                              <td className={TD_RIGHT}>
                                {s.receptions || 0}
                              </td>
                              <td className={TD_RIGHT}>
                                {fmtInt(s.recYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{s.recTds || 0}</td>
                              <td className={TD_RIGHT}>{s.fumbles || 0}</td>
                            </tr>
                          );
                        })}
                      {stats.filter((s) => (s.carries || 0) > 0).length >
                        1 && (
                        <tr className="border-t-2 border-border font-medium bg-surface-alt">
                          <td className={STICKY_TD}>Career</td>
                          <td className={TD_LEFT}></td>
                          <td className={TD_RIGHT}>{career.games}</td>
                          <td className={TD_RIGHT}>{fmtInt(career.carries)}</td>
                          <td className={TD_RIGHT_BOLD}>
                            {fmtInt(career.rushYards)}
                          </td>
                          <td className={TD_RIGHT}>
                            {career.carries > 0
                              ? (career.rushYards / career.carries).toFixed(1)
                              : "\u2014"}
                          </td>
                          <td className={TD_RIGHT_BOLD}>
                            {fmtInt(career.rushTds)}
                          </td>
                          <td className={TD_RIGHT}>
                            {fmtInt(career.receptions)}
                          </td>
                          <td className={TD_RIGHT}>
                            {fmtInt(career.recYards)}
                          </td>
                          <td className={TD_RIGHT}>{fmtInt(career.recTds)}</td>
                          <td className={TD_RIGHT}>{fmtInt(career.fumbles)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Receiving Stats Table */}
          {(isWRTE || career.receptions >= 10) && (
            <>
              <h2 className="text-lg font-semibold tracking-tight mb-4">
                Receiving Stats
              </h2>
              <div className="border border-border rounded-lg overflow-hidden bg-surface mb-6">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={STICKY_TH}>Season</th>
                        {[
                          "Team",
                          "G",
                          "Tgt",
                          "Rec",
                          "Yds",
                          "Y/R",
                          "TD",
                          "RushAtt",
                          "RushYds",
                          "RushTD",
                        ].map((col) => (
                          <th
                            key={col}
                            className={col === "Team" ? TH_LEFT : TH_RIGHT}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {stats
                        .filter(
                          (s) =>
                            (s.targets || 0) > 0 ||
                            (s.receptions || 0) > 0 ||
                            (isWRTE && (s.games || 0) > 0)
                        )
                        .map((s) => {
                          const rec = s.receptions || 0;
                          const yds = s.recYards || 0;
                          const yr =
                            rec > 0 ? (yds / rec).toFixed(1) : "\u2014";
                          return (
                            <tr key={`rec-${s.season}-${s.team}`}>
                              <td className={STICKY_TD}>
                                <Link
                                  href={`/football/seasons/${s.season}`}
                                  className={LINK_CLASSES}
                                >
                                  {s.season}
                                </Link>
                              </td>
                              <td className={TD_LEFT}>
                                {s.team ? (
                                  <Link
                                    href={`/football/teams/${s.team}/${s.season}`}
                                    className={LINK_CLASSES}
                                  >
                                    {s.team}
                                  </Link>
                                ) : (
                                  "\u2014"
                                )}
                              </td>
                              <td className={TD_RIGHT}>{s.games || 0}</td>
                              <td className={TD_RIGHT}>{s.targets || 0}</td>
                              <td className={TD_RIGHT_BOLD}>{rec}</td>
                              <td className={TD_RIGHT_BOLD}>{fmtInt(yds)}</td>
                              <td className={TD_RIGHT}>{yr}</td>
                              <td className={TD_RIGHT_BOLD}>
                                {s.recTds || 0}
                              </td>
                              <td className={TD_RIGHT}>{s.carries || 0}</td>
                              <td className={TD_RIGHT}>
                                {fmtInt(s.rushYards || 0)}
                              </td>
                              <td className={TD_RIGHT}>{s.rushTds || 0}</td>
                            </tr>
                          );
                        })}
                      {stats.filter(
                        (s) => (s.targets || 0) > 0 || (s.receptions || 0) > 0
                      ).length > 1 && (
                        <tr className="border-t-2 border-border font-medium bg-surface-alt">
                          <td className={STICKY_TD}>Career</td>
                          <td className={TD_LEFT}></td>
                          <td className={TD_RIGHT}>{career.games}</td>
                          <td className={TD_RIGHT}>{fmtInt(career.targets)}</td>
                          <td className={TD_RIGHT_BOLD}>
                            {fmtInt(career.receptions)}
                          </td>
                          <td className={TD_RIGHT_BOLD}>
                            {fmtInt(career.recYards)}
                          </td>
                          <td className={TD_RIGHT}>
                            {career.receptions > 0
                              ? (career.recYards / career.receptions).toFixed(1)
                              : "\u2014"}
                          </td>
                          <td className={TD_RIGHT_BOLD}>
                            {fmtInt(career.recTds)}
                          </td>
                          <td className={TD_RIGHT}>{fmtInt(career.carries)}</td>
                          <td className={TD_RIGHT}>
                            {fmtInt(career.rushYards)}
                          </td>
                          <td className={TD_RIGHT}>{fmtInt(career.rushTds)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* No stats message */}
      {stats.length === 0 && (
        <div className="border border-border rounded-lg bg-surface p-8 text-center">
          <p className="text-muted">No regular season statistics available for this player.</p>
        </div>
      )}
    </div>
  );
}
