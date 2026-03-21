import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtRecord, fmtWinPct } from "@/lib/format";

async function getData() {
  try {
    const latestYear =
      (
        await prisma.teams.findFirst({
          orderBy: { yearID: "desc" },
          select: { yearID: true },
        })
      )?.yearID || 2024;

    const [teams, seasons] = await Promise.all([
      prisma.teams.findMany({
        where: { yearID: latestYear },
        orderBy: [{ lgID: "asc" }, { divID: "asc" }, { W: "desc" }],
        include: { franchise: true },
      }),
      prisma.teams
        .findMany({
          where: {},
          select: { yearID: true },
          distinct: ["yearID"],
          orderBy: { yearID: "desc" },
          take: 20,
        })
        .then((r) => r.map((s) => s.yearID)),
    ]);

    return { latestYear, teams, seasons, hasData: teams.length > 0 };
  } catch {
    return { latestYear: 2024, teams: [], seasons: [], hasData: false };
  }
}

export const metadata = { title: "Baseball" };

export default async function BaseballPage() {
  const { latestYear, teams, seasons, hasData } = await getData();

  if (!hasData) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-semibold tracking-tighter mb-4">
          Baseball
        </h1>
        <p className="text-muted">
          No data loaded yet. Run the data pipeline first.
        </p>
      </div>
    );
  }

  // Group teams by league and division
  const grouped: Record<string, Record<string, typeof teams>> = {};
  for (const team of teams) {
    const lg = team.lgID === "AL" ? "American League" : "National League";
    const div = team.divID === "E" ? "East" : team.divID === "C" ? "Central" : "West";
    if (!grouped[lg]) grouped[lg] = {};
    if (!grouped[lg][div]) grouped[lg][div] = [];
    grouped[lg][div].push(team);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          Baseball
        </h1>
        <p className="text-muted mt-2 text-sm">
          Complete statistics from 1871 to {latestYear}
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
              href={`/baseball/seasons/${year}`}
              className={`px-3 py-1.5 text-sm font-mono rounded-md border transition-colors
                ${
                  year === latestYear
                    ? "border-accent bg-accent/5 text-accent"
                    : "border-border hover:bg-surface-alt text-muted hover:text-foreground"
                }`}
            >
              {year}
            </Link>
          ))}
        </div>
      </section>

      {/* Standings */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-6">
          {latestYear} Standings
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {Object.entries(grouped).map(([league, divisions]) => (
            <div key={league}>
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
                {league}
              </h3>
              <div className="space-y-6">
                {Object.entries(divisions).map(([div, divTeams]) => (
                  <div
                    key={div}
                    className="border border-border rounded-lg overflow-hidden bg-surface"
                  >
                    <div className="px-4 py-2 border-b border-border bg-surface-alt">
                      <span className="text-xs font-medium text-muted uppercase tracking-wider">
                        {div}
                      </span>
                    </div>
                    <div className="divide-y divide-border-light">
                      {divTeams.map((team) => (
                        <Link
                          key={team.teamID}
                          href={`/baseball/teams/${team.teamID}/${latestYear}`}
                          className="flex items-center px-4 py-2.5 hover:bg-surface-alt transition-colors"
                        >
                          <span className="flex-1 text-sm font-medium">
                            {team.name}
                          </span>
                          <span className="w-16 text-right text-sm font-mono">
                            {fmtRecord(team.W || 0, team.L || 0)}
                          </span>
                          <span className="w-12 text-right text-sm font-mono text-muted">
                            {fmtWinPct(team.W || 0, team.L || 0)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
