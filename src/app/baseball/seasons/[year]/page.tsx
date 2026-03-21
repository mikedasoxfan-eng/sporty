import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  fmtAvg,
  fmtEra,
  fmtInt,
  fmtRecord,
  fmtWinPct,
  fmtIP,
} from "@/lib/format";
import {
  battingAvg,
  onBasePct,
  sluggingPct,
  ops,
  era,
  whip,
  perNine,
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
      include: {
        player: {
          select: {
            nameFirst: true,
            nameLast: true,
            nameGiven: true,
            nameSuffix: true,
          },
        },
      },
      orderBy: [{ H: "desc" }],
      take: 10,
    }),
    prisma.pitching.findMany({
      where: { yearID: year, IPouts: { gte: 150 } },
      include: {
        player: {
          select: {
            nameFirst: true,
            nameLast: true,
            nameGiven: true,
            nameSuffix: true,
          },
        },
      },
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
    const lg =
      team.lgID === "AL"
        ? "American League"
        : team.lgID === "NL"
          ? "National League"
          : team.lgID;
    const div =
      team.divID === "E"
        ? "East"
        : team.divID === "C"
          ? "Central"
          : team.divID === "W"
            ? "West"
            : "Overall";
    if (!grouped[lg]) grouped[lg] = {};
    if (!grouped[lg][div]) grouped[lg][div] = [];
    grouped[lg][div].push(team);
  }

  // League totals & averages
  const totals = {
    R: 0,
    HR: 0,
    SB: 0,
    G: 0,
    AB: 0,
    H: 0,
    BB: 0,
    HBP: 0,
    SF: 0,
    doubles: 0,
    triples: 0,
    ER: 0,
    IPouts: 0,
    E: 0,
    DP: 0,
    HA: 0,
    HRA: 0,
    BBA: 0,
    SOA: 0,
    CG: 0,
    SHO: 0,
    SV: 0,
    SO: 0,
  };
  for (const t of teams) {
    totals.R += t.R || 0;
    totals.HR += t.HR || 0;
    totals.SB += t.SB || 0;
    totals.G += t.G || 0;
    totals.AB += t.AB || 0;
    totals.H += t.H || 0;
    totals.BB += t.BB || 0;
    totals.HBP += t.HBP || 0;
    totals.SF += t.SF || 0;
    totals.doubles += t.doubles || 0;
    totals.triples += t.triples || 0;
    totals.ER += t.ER || 0;
    totals.IPouts += t.IPouts || 0;
    totals.E += t.E || 0;
    totals.DP += t.DP || 0;
    totals.HA += t.HA || 0;
    totals.HRA += t.HRA || 0;
    totals.BBA += t.BBA || 0;
    totals.SOA += t.SOA || 0;
    totals.CG += t.CG || 0;
    totals.SHO += t.SHO || 0;
    totals.SV += t.SV || 0;
    totals.SO += t.SO || 0;
  }

  const leagueBA = totals.AB > 0 ? totals.H / totals.AB : null;
  const leagueOBP =
    totals.AB + totals.BB + totals.HBP + totals.SF > 0
      ? (totals.H + totals.BB + totals.HBP) /
        (totals.AB + totals.BB + totals.HBP + totals.SF)
      : null;
  const leagueSLG =
    totals.AB > 0
      ? (totals.H -
          totals.doubles -
          totals.triples -
          totals.HR +
          2 * totals.doubles +
          3 * totals.triples +
          4 * totals.HR) /
        totals.AB
      : null;
  const leagueERA =
    totals.IPouts > 0 ? (totals.ER * 27) / totals.IPouts : null;

  const totalGames = totals.G / 2;

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
          <Link
            href="/baseball"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
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
            href={`/baseball/seasons/${year}/advanced`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Advanced
          </Link>
          <Link
            href={`/baseball/seasons/${year}/fielding`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Fielding
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
          <p className="text-xs text-muted uppercase tracking-wider mb-1">
            Total Games
          </p>
          <p className="text-2xl font-semibold tracking-tight font-mono">
            {fmtInt(totalGames)}
          </p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">
            Total Runs
          </p>
          <p className="text-2xl font-semibold tracking-tight font-mono">
            {fmtInt(totals.R)}
          </p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">
            Total HR
          </p>
          <p className="text-2xl font-semibold tracking-tight font-mono">
            {fmtInt(totals.HR)}
          </p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">
            Total SB
          </p>
          <p className="text-2xl font-semibold tracking-tight font-mono">
            {fmtInt(totals.SB)}
          </p>
        </div>
      </section>

      {/* League Averages */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          League Averages
        </h2>
        <div className="flex flex-wrap gap-8">
          <div className="border-l-2 border-accent pl-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">
              BA
            </p>
            <p className="text-2xl font-semibold tracking-tight font-mono">
              {fmtAvg(leagueBA)}
            </p>
          </div>
          <div className="border-l-2 border-accent pl-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">
              OBP
            </p>
            <p className="text-2xl font-semibold tracking-tight font-mono">
              {fmtAvg(leagueOBP)}
            </p>
          </div>
          <div className="border-l-2 border-accent pl-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">
              SLG
            </p>
            <p className="text-2xl font-semibold tracking-tight font-mono">
              {fmtAvg(leagueSLG)}
            </p>
          </div>
          <div className="border-l-2 border-accent pl-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">
              ERA
            </p>
            <p className="text-2xl font-semibold tracking-tight font-mono">
              {leagueERA !== null ? leagueERA.toFixed(2) : "\u2014"}
            </p>
          </div>
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
                      <span className="w-14 text-right text-xs text-muted">
                        W-L
                      </span>
                      <span className="w-12 text-right text-xs text-muted">
                        Pct
                      </span>
                      <span className="w-10 text-right text-xs text-muted">
                        RS
                      </span>
                      <span className="w-10 text-right text-xs text-muted">
                        RA
                      </span>
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

      {/* Team Standard Batting */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Team Batting
        </h2>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="stat-scroll overflow-x-auto">
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Team",
                    "W",
                    "L",
                    "R",
                    "HR",
                    "BA",
                    "OBP",
                    "SLG",
                    "OPS",
                    "SB",
                    "Att",
                  ].map((col) => (
                    <th
                      key={col}
                      className={`py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider
                      ${col === "Team" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {teams.map((t) => {
                  const ba =
                    t.AB && t.H ? t.H / t.AB : null;
                  const obp =
                    t.AB && t.H
                      ? onBasePct(
                          t.H,
                          t.BB || 0,
                          t.HBP || 0,
                          t.AB,
                          t.SF || 0
                        )
                      : null;
                  const slg =
                    t.AB && t.H
                      ? sluggingPct(
                          t.H,
                          t.doubles || 0,
                          t.triples || 0,
                          t.HR || 0,
                          t.AB
                        )
                      : null;
                  return (
                    <tr key={t.teamID}>
                      <td className="py-2 px-3 text-left font-medium sticky left-0 z-10 bg-surface">
                        <Link
                          href={`/baseball/teams/${t.teamID}/${year}`}
                          className="text-link hover:text-link-hover hover:underline transition-colors"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.W}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.L}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.R}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.HR}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {fmtAvg(ba)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {fmtAvg(obp)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {fmtAvg(slg)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-medium">
                        {obp !== null && slg !== null
                          ? fmtAvg(obp + slg)
                          : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.SB}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.attendance ? fmtInt(t.attendance) : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Team Standard Pitching */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Team Pitching
        </h2>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="stat-scroll overflow-x-auto">
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Team",
                    "W",
                    "L",
                    "ERA",
                    "CG",
                    "SHO",
                    "SV",
                    "IP",
                    "HA",
                    "HRA",
                    "BBA",
                    "SOA",
                    "WHIP",
                    "SO/9",
                  ].map((col) => (
                    <th
                      key={col}
                      className={`py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider
                      ${col === "Team" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {teams.map((t) => {
                  const ip = t.IPouts || 0;
                  const teamWhip = whip(t.BBA || 0, t.HA || 0, ip);
                  const teamSo9 = perNine(t.SOA || 0, ip);
                  return (
                    <tr key={t.teamID}>
                      <td className="py-2 px-3 text-left font-medium sticky left-0 z-10 bg-surface">
                        <Link
                          href={`/baseball/teams/${t.teamID}/${year}`}
                          className="text-link hover:text-link-hover hover:underline transition-colors"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.W}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.L}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-medium">
                        {t.ERA ? fmtEra(t.ERA) : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.CG}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.SHO}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.SV}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {inningsPitchedDisplay(ip)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.HA}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.HRA}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.BBA}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.SOA}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {teamWhip !== null ? teamWhip.toFixed(2) : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {teamSo9 !== null ? teamSo9.toFixed(1) : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Team Fielding */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Team Fielding
        </h2>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="stat-scroll overflow-x-auto">
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Team", "E", "DP", "FP"].map((col) => (
                    <th
                      key={col}
                      className={`py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider
                      ${col === "Team" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {teams.map((t) => (
                  <tr key={t.teamID}>
                    <td className="py-2 px-3 text-left font-medium sticky left-0 z-10 bg-surface">
                      <Link
                        href={`/baseball/teams/${t.teamID}/${year}`}
                        className="text-link hover:text-link-hover hover:underline transition-colors"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {t.E}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {t.DP}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {t.FP !== null && t.FP !== undefined
                        ? fmtAvg(t.FP)
                        : "\u2014"}
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
