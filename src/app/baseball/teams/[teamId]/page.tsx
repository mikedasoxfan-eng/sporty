import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtRecord, fmtWinPct, fmtInt, ordinal } from "@/lib/format";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ teamId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId } = await params;
  const franchise = await prisma.teamsFranchises.findFirst({
    where: {
      teams: { some: { teamID: teamId } },
    },
  });
  return {
    title: franchise?.franchName || teamId,
  };
}

async function getData(teamId: string) {
  // Get all Teams entries for this teamID
  const seasons = await prisma.teams.findMany({
    where: { teamID: teamId },
    orderBy: { yearID: "desc" },
    include: { franchise: true },
  });

  if (seasons.length === 0) return null;

  const franchise = seasons[0].franchise;

  // Compute all-time totals
  let totalW = 0;
  let totalL = 0;
  let pennants = 0;
  let worldSeries = 0;

  for (const s of seasons) {
    totalW += s.W || 0;
    totalL += s.L || 0;
    if (s.LgWin === "Y") pennants++;
    if (s.WSWin === "Y") worldSeries++;
  }

  // Find other teamIDs in the same franchise for prev/next links
  let franchiseTeamIDs: string[] = [];
  if (franchise) {
    const otherTeams = await prisma.teams.findMany({
      where: { franchID: franchise.franchID, teamID: { not: teamId } },
      select: { teamID: true },
      distinct: ["teamID"],
    });
    franchiseTeamIDs = otherTeams.map((t) => t.teamID);
  }

  return { seasons, franchise, totalW, totalL, pennants, worldSeries, franchiseTeamIDs };
}

export default async function FranchiseHistoryPage({ params }: Props) {
  const { teamId } = await params;
  const data = await getData(teamId);

  if (!data) notFound();

  const { seasons, franchise, totalW, totalL, pennants, worldSeries, franchiseTeamIDs } = data;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/baseball"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Baseball
          </Link>
          <span className="text-xs text-muted-light">/</span>
          <Link
            href="/baseball/teams"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Teams
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {franchise?.franchName || teamId}
        </h1>
        <p className="text-muted mt-2 text-sm">
          {seasons[seasons.length - 1].yearID}&ndash;{seasons[0].yearID}
        </p>
      </div>

      {/* Summary stats */}
      <section className="mb-10 flex flex-wrap gap-8">
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">All-Time Record</p>
          <p className="text-2xl font-semibold tracking-tight font-mono">
            {fmtRecord(totalW, totalL)}
          </p>
          <p className="text-sm font-mono text-muted">{fmtWinPct(totalW, totalL)}</p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Seasons</p>
          <p className="text-2xl font-semibold tracking-tight font-mono">{seasons.length}</p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Pennants</p>
          <p className="text-2xl font-semibold tracking-tight font-mono">{pennants}</p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">World Series</p>
          <p className="text-2xl font-semibold tracking-tight font-mono">{worldSeries}</p>
        </div>
      </section>

      {/* Related franchise teamIDs */}
      {franchiseTeamIDs.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
            Related Franchise IDs
          </h2>
          <div className="flex flex-wrap gap-2">
            {franchiseTeamIDs.map((id) => (
              <Link
                key={id}
                href={`/baseball/teams/${id}`}
                className="px-3 py-1.5 text-sm font-mono rounded-md border border-border hover:bg-surface-alt text-muted hover:text-foreground transition-colors"
              >
                {id}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Season-by-season table */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Season History
        </h2>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="stat-scroll overflow-x-auto">
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Year", "W", "L", "Pct", "Finish", "Attendance"].map(
                    (col) => (
                      <th
                        key={col}
                        className={`py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                        ${col === "Year" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {seasons.map((s) => (
                  <tr key={s.yearID}>
                    <td className="py-2 px-3 text-left font-medium sticky left-0 z-10 bg-surface">
                      <Link
                        href={`/baseball/teams/${teamId}/${s.yearID}`}
                        className="text-link hover:text-link-hover hover:underline transition-colors"
                      >
                        {s.yearID}
                        {s.WSWin === "Y" && (
                          <span className="ml-1.5 text-xs text-accent" title="World Series Champions">
                            WS
                          </span>
                        )}
                        {s.WSWin !== "Y" && s.LgWin === "Y" && (
                          <span className="ml-1.5 text-xs text-muted" title="Pennant Winner">
                            P
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{s.W}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{s.L}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {fmtWinPct(s.W || 0, s.L || 0)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {s.Rank ? ordinal(s.Rank) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {s.attendance ? fmtInt(s.attendance) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
