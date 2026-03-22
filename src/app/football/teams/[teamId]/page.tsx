import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { fmtInt } from "@/lib/format";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ teamId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId } = await params;
  const team = await prisma.nFLTeam.findUnique({
    where: { teamAbbr: teamId },
    select: { teamName: true, teamNick: true },
  });
  return {
    title: team ? `${team.teamName || team.teamNick}` : `${teamId} History`,
  };
}

async function getTeamData(teamId: string) {
  const [team, standings] = await Promise.all([
    prisma.nFLTeam.findUnique({ where: { teamAbbr: teamId } }),
    prisma.nFLStandings.findMany({
      where: { team: teamId },
      orderBy: { season: "desc" },
    }),
  ]);

  if (!team && standings.length === 0) return null;

  return { team, standings };
}

export default async function NFLTeamHistoryPage({ params }: Props) {
  const { teamId } = await params;
  const data = await getTeamData(teamId);

  if (!data) notFound();

  const { team, standings } = data;
  const teamName = team
    ? `${team.teamName || team.teamNick || ""}`.trim()
    : teamId;

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
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        {team?.teamLogo && (
          <img
            src={team.teamLogo}
            alt={teamName}
            width={64}
            height={64}
            className="w-16 h-16 object-contain"
            
         />
        )}
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
            {teamName}
          </h1>
          {team && (
            <p className="text-muted text-sm mt-1">
              {team.teamConf} {team.teamDivision}
            </p>
          )}
        </div>
      </div>

      {/* Season History Table */}
      {standings.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Season History
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Year", "W", "L", "T", "Pct", "PF", "PA", "Diff", "Playoff"].map(
                      (col) => (
                        <th
                          key={col}
                          className={`py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider
                          ${col === "Year" || col === "Playoff" ? "text-left" : "text-right"}`}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {standings.map((s) => {
                    const diff = (s.scored || 0) - (s.allowed || 0);
                    const diffStr =
                      diff > 0 ? `+${diff}` : diff === 0 ? "0" : `${diff}`;
                    const pct =
                      s.pct !== null && s.pct !== undefined
                        ? s.pct.toFixed(3).slice(s.pct >= 1 ? 0 : 1)
                        : "\u2014";
                    return (
                      <tr key={s.season}>
                        <td className="py-2 px-3 text-left font-medium">
                          <Link
                            href={`/football/teams/${teamId}/${s.season}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {s.season}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {s.wins ?? 0}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {s.losses ?? 0}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {s.ties ?? 0}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs font-medium">
                          {pct}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {s.scored ?? "\u2014"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {s.allowed ?? "\u2014"}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono text-xs ${
                            diff > 0
                              ? "text-green-600 dark:text-green-400"
                              : diff < 0
                                ? "text-red-500"
                                : ""
                          }`}
                        >
                          {diffStr}
                        </td>
                        <td className="py-2 px-3 text-left text-xs text-muted">
                          {s.playoff || "\u2014"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <div className="border border-border rounded-lg bg-surface p-8 text-center">
          <p className="text-muted">No season history available for this team.</p>
        </div>
      )}
    </div>
  );
}
