import Link from "next/link";

import { prisma } from "@/lib/db";
import { fmtInt } from "@/lib/format";

async function getData() {
  try {
    const latestSeason =
      (
        await prisma.nFLStandings.findFirst({
          orderBy: { season: "desc" },
          select: { season: true },
        })
      )?.season || 2024;

    const [standings, teams, seasons] = await Promise.all([
      prisma.nFLStandings.findMany({
        where: { season: latestSeason },
        orderBy: [{ conf: "asc" }, { division: "asc" }, { divRank: "asc" }],
      }),
      prisma.nFLTeam.findMany(),
      prisma.nFLStandings
        .findMany({
          select: { season: true },
          distinct: ["season"],
          orderBy: { season: "desc" },
          take: 20,
        })
        .then((r) => r.map((s) => s.season)),
    ]);

    const teamMap = new Map(teams.map((t) => [t.teamAbbr, t]));

    return { latestSeason, standings, teamMap, seasons, hasData: standings.length > 0 };
  } catch {
    return {
      latestSeason: 2024,
      standings: [],
      teamMap: new Map(),
      seasons: [],
      hasData: false,
    };
  }
}

export const metadata = { title: "Football" };

export default async function FootballPage() {
  const { latestSeason, standings, teamMap, seasons, hasData } = await getData();

  if (!hasData) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-semibold tracking-tighter mb-4">
          Football
        </h1>
        <p className="text-muted">
          No data loaded yet. Run the data pipeline first.
        </p>
      </div>
    );
  }

  // Group standings by conference and division
  const grouped: Record<string, Record<string, (typeof standings)[number][]>> = {};
  for (const row of standings) {
    const conf = row.conf || "Unknown";
    const div = row.division || "Unknown";
    if (!grouped[conf]) grouped[conf] = {};
    if (!grouped[conf][div]) grouped[conf][div] = [];
    grouped[conf][div].push(row);
  }

  // Sort conferences: AFC first, NFC second
  const confOrder = ["AFC", "NFC"];
  const sortedConfs = Object.entries(grouped).sort(
    (a, b) => (confOrder.indexOf(a[0]) ?? 99) - (confOrder.indexOf(b[0]) ?? 99)
  );

  // Sort divisions within each conference
  const divOrder = ["East", "North", "South", "West"];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          Football
        </h1>
        <p className="text-muted mt-2 text-sm">
          NFL statistics and standings
        </p>
      </div>

      {/* Season selector */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
          Seasons
        </h2>
        <div className="flex flex-wrap gap-2">
          {seasons.map((year) => (
            <Link
              key={year}
              href={`/football/seasons/${year}`}
              className={`px-3 py-1.5 text-sm font-mono rounded-md border transition-colors
                ${
                  year === latestSeason
                    ? "border-accent bg-accent/5 text-accent"
                    : "border-border hover:bg-surface-alt text-muted hover:text-foreground"
                }`}
            >
              {year}
            </Link>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="mb-10 flex flex-wrap gap-3">
        <Link
          href="/football/teams"
          className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
        >
          All Teams
        </Link>
        <Link
          href={`/football/seasons/${latestSeason}/passing`}
          className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
        >
          Passing Leaders
        </Link>
        <Link
          href={`/football/seasons/${latestSeason}/rushing`}
          className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
        >
          Rushing Leaders
        </Link>
        <Link
          href={`/football/seasons/${latestSeason}/receiving`}
          className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
        >
          Receiving Leaders
        </Link>
      </section>

      {/* Standings */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-6">
          {latestSeason} Standings
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
                <div className="space-y-6">
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
                          W-L-T
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
                              href={`/football/teams/${s.team}/${latestSeason}`}
                              className="flex items-center px-4 py-2.5 hover:bg-surface-alt transition-colors"
                            >
                              <span className="flex items-center gap-2 flex-1">
                                {team?.teamLogo && (
                                  <img
                                    src={team.teamLogo}
                                    alt={team.teamNick || s.team}
                                    width={24}
                                    height={24}
                                    className="w-6 h-6 object-contain"
                                    
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
