import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { fmtInt } from "@/lib/format";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const LINK_CLASSES =
  "text-link hover:text-link-hover hover:underline transition-colors";

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
  params: Promise<{ year: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `${year} NFL Season` };
}

async function getSeasonData(year: number) {
  const standings = await prisma.nFLStandings.findMany({
    where: { season: year },
    orderBy: [{ conf: "asc" }, { division: "asc" }, { divRank: "asc" }],
  });

  if (standings.length === 0) return null;

  const [teams, passingLeaders, rushingLeaders, receivingLeaders, postseasonGames] =
    await Promise.all([
      prisma.nFLTeam.findMany(),
      prisma.nFLPlayerStats.findMany({
        where: { season: year, seasonType: "REG", passAttempts: { gte: 100 } },
        include: {
          player: {
            select: { id: true, displayName: true, firstName: true, lastName: true },
          },
        },
        orderBy: { passYards: "desc" },
        take: 5,
      }),
      prisma.nFLPlayerStats.findMany({
        where: { season: year, seasonType: "REG", carries: { gte: 50 } },
        include: {
          player: {
            select: { id: true, displayName: true, firstName: true, lastName: true },
          },
        },
        orderBy: { rushYards: "desc" },
        take: 5,
      }),
      prisma.nFLPlayerStats.findMany({
        where: { season: year, seasonType: "REG", targets: { gte: 30 } },
        include: {
          player: {
            select: { id: true, displayName: true, firstName: true, lastName: true },
          },
        },
        orderBy: { recYards: "desc" },
        take: 5,
      }),
      prisma.nFLGame.findMany({
        where: {
          season: year,
          gameType: { in: ["WC", "DIV", "CON", "SB"] },
        },
        orderBy: [{ week: "asc" }],
      }),
    ]);

  const teamMap = new Map(teams.map((t) => [t.teamAbbr, t]));

  return {
    standings,
    teamMap,
    passingLeaders,
    rushingLeaders,
    receivingLeaders,
    postseasonGames,
  };
}

export default async function NFLSeasonPage({ params }: Props) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr);
  const data = await getSeasonData(year);

  if (!data) notFound();

  const {
    standings,
    teamMap,
    passingLeaders,
    rushingLeaders,
    receivingLeaders,
    postseasonGames,
  } = data;

  // Group standings by conference and division
  const grouped: Record<string, Record<string, typeof standings>> = {};
  for (const row of standings) {
    const conf = row.conf || "Unknown";
    const div = row.division || "Unknown";
    if (!grouped[conf]) grouped[conf] = {};
    if (!grouped[conf][div]) grouped[conf][div] = [];
    grouped[conf][div].push(row);
  }

  const confOrder = ["AFC", "NFC"];
  const divOrder = ["East", "North", "South", "West"];

  const sortedConfs = Object.entries(grouped).sort(
    (a, b) => (confOrder.indexOf(a[0]) ?? 99) - (confOrder.indexOf(b[0]) ?? 99)
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/football"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Football
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {year} <span className="text-muted">NFL Season</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/football/seasons/${year}/passing`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Passing Leaders
          </Link>
          <Link
            href={`/football/seasons/${year}/rushing`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Rushing Leaders
          </Link>
          <Link
            href={`/football/seasons/${year}/receiving`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Receiving Leaders
          </Link>
          <Link
            href={`/football/seasons/${year - 1}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
          >
            {year - 1}
          </Link>
          <Link
            href={`/football/seasons/${year + 1}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
          >
            {year + 1}
          </Link>
        </div>
      </div>

      {/* Season Leaders */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Season Leaders
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Passing */}
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="px-4 py-2 border-b border-border bg-surface-alt">
              <Link
                href={`/football/seasons/${year}/passing`}
                className="text-xs font-medium text-muted uppercase tracking-wider hover:text-foreground transition-colors"
              >
                Passing Yards
              </Link>
            </div>
            <div className="divide-y divide-border-light">
              {passingLeaders.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center px-4 py-2.5"
                >
                  <span className="w-5 text-xs text-muted font-mono">
                    {i + 1}
                  </span>
                  <Link
                    href={`/football/players/${p.player.id}`}
                    className={`flex-1 text-sm ${LINK_CLASSES}`}
                  >
                    {p.player.displayName ||
                      `${p.player.firstName} ${p.player.lastName}`}
                  </Link>
                  <span className="text-xs text-muted mr-2">{p.team}</span>
                  <span className="font-mono text-sm font-medium">
                    {fmtInt(p.passYards || 0)}
                  </span>
                </div>
              ))}
              {passingLeaders.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted">No data</div>
              )}
            </div>
          </div>

          {/* Rushing */}
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="px-4 py-2 border-b border-border bg-surface-alt">
              <Link
                href={`/football/seasons/${year}/rushing`}
                className="text-xs font-medium text-muted uppercase tracking-wider hover:text-foreground transition-colors"
              >
                Rushing Yards
              </Link>
            </div>
            <div className="divide-y divide-border-light">
              {rushingLeaders.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center px-4 py-2.5"
                >
                  <span className="w-5 text-xs text-muted font-mono">
                    {i + 1}
                  </span>
                  <Link
                    href={`/football/players/${p.player.id}`}
                    className={`flex-1 text-sm ${LINK_CLASSES}`}
                  >
                    {p.player.displayName ||
                      `${p.player.firstName} ${p.player.lastName}`}
                  </Link>
                  <span className="text-xs text-muted mr-2">{p.team}</span>
                  <span className="font-mono text-sm font-medium">
                    {fmtInt(p.rushYards || 0)}
                  </span>
                </div>
              ))}
              {rushingLeaders.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted">No data</div>
              )}
            </div>
          </div>

          {/* Receiving */}
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="px-4 py-2 border-b border-border bg-surface-alt">
              <Link
                href={`/football/seasons/${year}/receiving`}
                className="text-xs font-medium text-muted uppercase tracking-wider hover:text-foreground transition-colors"
              >
                Receiving Yards
              </Link>
            </div>
            <div className="divide-y divide-border-light">
              {receivingLeaders.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center px-4 py-2.5"
                >
                  <span className="w-5 text-xs text-muted font-mono">
                    {i + 1}
                  </span>
                  <Link
                    href={`/football/players/${p.player.id}`}
                    className={`flex-1 text-sm ${LINK_CLASSES}`}
                  >
                    {p.player.displayName ||
                      `${p.player.firstName} ${p.player.lastName}`}
                  </Link>
                  <span className="text-xs text-muted mr-2">{p.team}</span>
                  <span className="font-mono text-sm font-medium">
                    {fmtInt(p.recYards || 0)}
                  </span>
                </div>
              ))}
              {receivingLeaders.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted">No data</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Postseason Results */}
      {postseasonGames.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Postseason
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface divide-y divide-border-light">
            {postseasonGames.map((g) => {
              const awayTeam = teamMap.get(g.awayTeam || "");
              const homeTeam = teamMap.get(g.homeTeam || "");
              const isSB = g.gameType === "SB";
              return (
                <div key={g.gameId} className="flex items-center px-4 py-3">
                  <span className="w-24 text-xs text-muted font-medium">
                    {isSB ? "Super Bowl" : `Wk ${g.week}`}
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="flex items-center gap-1">
                      {awayTeam?.teamLogo && (
                        <img
                          src={awayTeam.teamLogo}
                          alt={g.awayTeam || ""}
                          width={16}
                          height={16}
                          className="w-4 h-4 object-contain inline"
                          
                       />
                      )}
                      <Link
                        href={`/football/teams/${g.awayTeam}/${year}`}
                        className={LINK_CLASSES}
                      >
                        {g.awayTeam}
                      </Link>
                      <span className="text-muted mx-1">@</span>
                      {homeTeam?.teamLogo && (
                        <img
                          src={homeTeam.teamLogo}
                          alt={g.homeTeam || ""}
                          width={16}
                          height={16}
                          className="w-4 h-4 object-contain inline"
                          
                       />
                      )}
                      <Link
                        href={`/football/teams/${g.homeTeam}/${year}`}
                        className={LINK_CLASSES}
                      >
                        {g.homeTeam}
                      </Link>
                    </span>
                  </span>
                  <span className="font-mono text-sm">
                    {g.awayScore !== null && g.homeScore !== null
                      ? `${g.awayScore}-${g.homeScore}`
                      : "\u2014"}
                    {g.overtime && (
                      <span className="text-muted text-xs ml-1">(OT)</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Standings */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Standings
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {sortedConfs.map(([conf, divisions]) => {
            const sortedDivs = Object.entries(divisions).sort(
              (a, b) =>
                (divOrder.indexOf(a[0].replace(/^.*\s/, "")) ?? 99) -
                (divOrder.indexOf(b[0].replace(/^.*\s/, "")) ?? 99)
            );
            return (
              <div key={conf}>
                <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
                  {conf}
                </h3>
                <div className="space-y-4">
                  {sortedDivs.map(([div, divTeams]) => (
                    <div
                      key={div}
                      className="border border-border rounded-lg overflow-hidden bg-surface"
                    >
                      <div className="px-4 py-2 border-b border-border bg-surface-alt flex">
                        <span className="flex-1 text-xs font-medium text-muted uppercase tracking-wider">
                          {div}
                        </span>
                        <span className="w-14 text-right text-xs text-muted">
                          W-L
                        </span>
                        <span className="w-12 text-right text-xs text-muted">
                          Pct
                        </span>
                        <span className="w-10 text-right text-xs text-muted">
                          PF
                        </span>
                        <span className="w-10 text-right text-xs text-muted">
                          PA
                        </span>
                      </div>
                      <div className="divide-y divide-border-light">
                        {divTeams.map((s) => {
                          const team = teamMap.get(s.team);
                          const record =
                            s.ties && s.ties > 0
                              ? `${s.wins ?? 0}-${s.losses ?? 0}-${s.ties}`
                              : `${s.wins ?? 0}-${s.losses ?? 0}`;
                          const pct =
                            s.pct !== null && s.pct !== undefined
                              ? s.pct.toFixed(3).slice(s.pct >= 1 ? 0 : 1)
                              : "\u2014";
                          return (
                            <Link
                              key={s.team}
                              href={`/football/teams/${s.team}/${year}`}
                              className="flex items-center px-4 py-2.5 hover:bg-surface-alt transition-colors"
                            >
                              <span className="flex items-center gap-2 flex-1">
                                {team?.teamLogo && (
                                  <img
                                    src={team.teamLogo}
                                    alt={team.teamNick || s.team}
                                    width={20}
                                    height={20}
                                    className="w-5 h-5 object-contain"
                                    
                                 />
                                )}
                                <span className="text-sm font-medium">
                                  {team
                                    ? `${team.teamName || team.teamNick || ""}`.trim()
                                    : s.team}
                                </span>
                              </span>
                              <span className="w-14 text-right text-sm font-mono">
                                {record}
                              </span>
                              <span className="w-12 text-right text-sm font-mono text-muted">
                                {pct}
                              </span>
                              <span className="w-10 text-right text-sm font-mono text-xs text-muted">
                                {s.scored ?? "\u2014"}
                              </span>
                              <span className="w-10 text-right text-sm font-mono text-xs text-muted">
                                {s.allowed ?? "\u2014"}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
