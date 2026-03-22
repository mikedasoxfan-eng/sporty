import Link from "next/link";

import { prisma } from "@/lib/db";

export const metadata = { title: "NFL Teams" };

async function getData() {
  try {
    const [teams, latestStandings] = await Promise.all([
      prisma.nFLTeam.findMany({
        orderBy: [{ teamConf: "asc" }, { teamDivision: "asc" }, { teamName: "asc" }],
      }),
      prisma.nFLStandings.findFirst({
        orderBy: { season: "desc" },
        select: { season: true },
      }),
    ]);

    const latestSeason = latestStandings?.season || 2024;

    // Get latest standings for records
    const standings = await prisma.nFLStandings.findMany({
      where: { season: latestSeason },
    });
    const standingsMap = new Map(standings.map((s) => [s.team, s]));

    return { teams, standingsMap, latestSeason, hasData: teams.length > 0 };
  } catch {
    return { teams: [], standingsMap: new Map(), latestSeason: 2024, hasData: false };
  }
}

export default async function NFLTeamsPage() {
  const { teams, standingsMap, latestSeason, hasData } = await getData();

  if (!hasData) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-semibold tracking-tighter mb-4">NFL Teams</h1>
        <p className="text-muted">No team data found.</p>
      </div>
    );
  }

  // Group by conference and division
  const grouped: Record<string, Record<string, (typeof teams)[number][]>> = {};
  for (const team of teams) {
    const conf = team.teamConf || "Unknown";
    const div = team.teamDivision || "Unknown";
    if (!grouped[conf]) grouped[conf] = {};
    if (!grouped[conf][div]) grouped[conf][div] = [];
    grouped[conf][div].push(team);
  }

  const confOrder = ["AFC", "NFC"];
  const divOrder = ["East", "North", "South", "West"];

  const sortedConfs = Object.entries(grouped).sort(
    (a, b) => (confOrder.indexOf(a[0]) ?? 99) - (confOrder.indexOf(b[0]) ?? 99)
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
          NFL Teams
        </h1>
        <p className="text-muted mt-2 text-sm">
          All 32 NFL teams by conference and division
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {sortedConfs.map(([conf, divisions]) => {
          const sortedDivs = Object.entries(divisions).sort(
            (a, b) =>
              (divOrder.indexOf(a[0].replace(/^.*\s/, "")) ?? 99) -
              (divOrder.indexOf(b[0].replace(/^.*\s/, "")) ?? 99)
          );
          return (
            <div key={conf}>
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
                {conf}
              </h2>
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
                        {latestSeason} W-L
                      </span>
                    </div>
                    <div className="divide-y divide-border-light">
                      {divTeams.map((team) => {
                        const s = standingsMap.get(team.teamAbbr);
                        const record = s
                          ? s.ties && s.ties > 0
                            ? `${s.wins ?? 0}-${s.losses ?? 0}-${s.ties}`
                            : `${s.wins ?? 0}-${s.losses ?? 0}`
                          : "\u2014";
                        return (
                          <Link
                            key={team.teamAbbr}
                            href={`/football/teams/${team.teamAbbr}`}
                            className="flex items-center px-4 py-2.5 hover:bg-surface-alt transition-colors"
                          >
                            <span className="flex items-center gap-3 flex-1">
                              {team.teamLogo && (
                                <img
                                  src={team.teamLogo}
                                  alt={team.teamNick || team.teamAbbr}
                                  width={28}
                                  height={28}
                                  className="w-7 h-7 object-contain"
                                  
                               />
                              )}
                              <span className="text-sm font-medium">
                                {team.teamName}
                              </span>
                              <span className="text-xs text-muted font-mono">
                                {team.teamAbbr}
                              </span>
                            </span>
                            <span className="w-14 text-right text-sm font-mono">
                              {record}
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
    </div>
  );
}
