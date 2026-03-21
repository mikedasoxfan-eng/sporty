import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtAvg, fmtEra, fmtInt, fmtRecord, fmtWinPct, fmtIP } from "@/lib/format";
import {
  battingAvg,
  onBasePct,
  sluggingPct,
  ops,
  era,
  whip,
  inningsPitchedDisplay,
} from "@/lib/stats";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ year: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `${year} MLB Season` };
}

async function getSeasonData(year: number) {
  const teams = await prisma.teams.findMany({
    where: { yearID: year },
    orderBy: [{ lgID: "asc" }, { divID: "asc" }, { W: "desc" }],
  });

  if (teams.length === 0) return null;

  const [postseason, topBatters, topPitchers] = await Promise.all([
    prisma.seriesPost.findMany({
      where: { yearID: year },
      orderBy: [{ round: "asc" }],
    }),
    prisma.batting.findMany({
      where: { yearID: year, AB: { gte: 100 } },
      include: { player: { select: { nameFirst: true, nameLast: true } } },
      orderBy: [{ H: "desc" }],
      take: 10,
    }),
    prisma.pitching.findMany({
      where: { yearID: year, IPouts: { gte: 150 } },
      include: { player: { select: { nameFirst: true, nameLast: true } } },
      orderBy: [{ W: "desc" }],
      take: 10,
    }),
  ]);

  return { teams, postseason, topBatters, topPitchers };
}

export default async function SeasonPage({ params }: Props) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr);
  const data = await getSeasonData(year);

  if (!data) notFound();

  const { teams, postseason, topBatters, topPitchers } = data;

  // Group teams by league and division
  const grouped: Record<string, Record<string, typeof teams>> = {};
  for (const team of teams) {
    const lg = team.lgID === "AL" ? "American League" : team.lgID === "NL" ? "National League" : team.lgID;
    const div = team.divID === "E" ? "East" : team.divID === "C" ? "Central" : team.divID === "W" ? "West" : "Overall";
    if (!grouped[lg]) grouped[lg] = {};
    if (!grouped[lg][div]) grouped[lg][div] = [];
    grouped[lg][div].push(team);
  }

  // League totals
  const leagueTotals = {
    R: teams.reduce((s, t) => s + (t.R || 0), 0),
    HR: teams.reduce((s, t) => s + (t.HR || 0), 0),
    SB: teams.reduce((s, t) => s + (t.SB || 0), 0),
    G: teams.reduce((s, t) => s + (t.G || 0), 0) / 2,
  };

  // Round display names
  const roundNames: Record<string, string> = {
    WS: "World Series",
    ALCS: "ALCS",
    NLCS: "NLCS",
    ALDS: "ALDS",
    NLDS: "NLDS",
    ALDS1: "ALDS",
    ALDS2: "ALDS",
    NLDS1: "NLDS",
    NLDS2: "NLDS",
    ALWC: "AL Wild Card",
    NLWC: "NL Wild Card",
    WC: "Wild Card",
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/baseball" className="text-xs text-muted hover:text-foreground transition-colors">
            Baseball
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {year} <span className="text-muted">MLB Season</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/baseball/seasons/${year}/batting`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Batting Leaders
          </Link>
          <Link
            href={`/baseball/seasons/${year}/pitching`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Pitching Leaders
          </Link>
          <Link
            href={`/baseball/seasons/${year - 1}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
          >
            {year - 1}
          </Link>
          <Link
            href={`/baseball/seasons/${year + 1}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
          >
            {year + 1}
          </Link>
        </div>
      </div>

      {/* League overview stats */}
      <section className="mb-10 flex flex-wrap gap-8">
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Total Games</p>
          <p className="text-2xl font-semibold tracking-tight font-mono">{fmtInt(leagueTotals.G)}</p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Total Runs</p>
          <p className="text-2xl font-semibold tracking-tight font-mono">{fmtInt(leagueTotals.R)}</p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Total HR</p>
          <p className="text-2xl font-semibold tracking-tight font-mono">{fmtInt(leagueTotals.HR)}</p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Total SB</p>
          <p className="text-2xl font-semibold tracking-tight font-mono">{fmtInt(leagueTotals.SB)}</p>
        </div>
      </section>

      {/* Postseason Results */}
      {postseason.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Postseason
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface divide-y divide-border-light">
            {postseason.map((s, i) => (
              <div key={i} className="flex items-center px-4 py-3">
                <span className="w-32 text-xs text-muted font-medium">
                  {roundNames[s.round] || s.round}
                </span>
                <span className="flex-1 text-sm">
                  <span className="font-medium">{s.teamIDwinner}</span>
                  {" over "}
                  <span className="text-muted">{s.teamIDloser}</span>
                </span>
                <span className="font-mono text-sm">
                  {s.wins}-{s.losses}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Standings */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Standings
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {Object.entries(grouped).map(([league, divisions]) => (
            <div key={league}>
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
                {league}
              </h3>
              <div className="space-y-4">
                {Object.entries(divisions).map(([div, divTeams]) => (
                  <div
                    key={div}
                    className="border border-border rounded-lg overflow-hidden bg-surface"
                  >
                    <div className="px-4 py-2 border-b border-border bg-surface-alt flex">
                      <span className="flex-1 text-xs font-medium text-muted uppercase tracking-wider">
                        {div}
                      </span>
                      <span className="w-14 text-right text-xs text-muted">W-L</span>
                      <span className="w-12 text-right text-xs text-muted">Pct</span>
                      <span className="w-10 text-right text-xs text-muted">RS</span>
                      <span className="w-10 text-right text-xs text-muted">RA</span>
                    </div>
                    <div className="divide-y divide-border-light">
                      {divTeams.map((team) => (
                        <Link
                          key={team.teamID}
                          href={`/baseball/teams/${team.teamID}/${year}`}
                          className="flex items-center px-4 py-2.5 hover:bg-surface-alt transition-colors"
                        >
                          <span className="flex-1 text-sm font-medium">
                            {team.name}
                          </span>
                          <span className="w-14 text-right text-sm font-mono">
                            {fmtRecord(team.W || 0, team.L || 0)}
                          </span>
                          <span className="w-12 text-right text-sm font-mono text-muted">
                            {fmtWinPct(team.W || 0, team.L || 0)}
                          </span>
                          <span className="w-10 text-right text-sm font-mono text-xs text-muted">
                            {team.R}
                          </span>
                          <span className="w-10 text-right text-sm font-mono text-xs text-muted">
                            {team.RA}
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

      {/* Team batting/pitching overview */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Team Statistics
        </h2>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="stat-scroll overflow-x-auto">
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Team", "W", "L", "R", "HR", "BA", "ERA", "SB", "E", "Att"].map(
                    (col) => (
                      <th
                        key={col}
                        className={`py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider
                        ${col === "Team" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {teams.map((t) => (
                  <tr key={t.teamID}>
                    <td className="py-2 px-3 text-left font-medium sticky left-0 z-10 bg-surface">
                      <Link href={`/baseball/teams/${t.teamID}/${year}`} className="hover:text-accent transition-colors">
                        {t.name}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{t.W}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{t.L}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{t.R}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{t.HR}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {t.AB && t.H ? fmtAvg(t.H / t.AB) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{t.ERA ? fmtEra(t.ERA) : "—"}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{t.SB}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{t.E}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{t.attendance ? fmtInt(t.attendance) : "—"}</td>
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
