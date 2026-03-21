import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  fmtAvg,
  fmtEra,
  fmtInt,
  fmtIP,
  fmtRecord,
  fmtWinPct,
  ordinal,
  fullName,
} from "@/lib/format";
import {
  battingAvg,
  onBasePct,
  sluggingPct,
  ops,
  totalBases,
  plateAppearances,
  era,
  whip,
  perNine,
  inningsPitchedDisplay,
  pythagoreanWinPct,
} from "@/lib/stats";
import { StatCard } from "@/components/ui/StatCard";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ teamId: string; year: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId, year } = await params;
  const team = await prisma.teams.findFirst({
    where: { teamID: teamId, yearID: parseInt(year) },
    select: { name: true },
  });
  return { title: team ? `${team.name} ${year}` : `${teamId} ${year}` };
}

async function getTeamData(teamId: string, year: number) {
  const team = await prisma.teams.findFirst({
    where: { teamID: teamId, yearID: year },
    include: { franchise: true },
  });
  if (!team) return null;

  const [batters, pitchers, manager] = await Promise.all([
    prisma.batting.findMany({
      where: { teamID: teamId, yearID: year },
      include: { player: { select: { nameFirst: true, nameLast: true, nameGiven: true } } },
      orderBy: [{ AB: "desc" }],
    }),
    prisma.pitching.findMany({
      where: { teamID: teamId, yearID: year },
      include: { player: { select: { nameFirst: true, nameLast: true, nameGiven: true } } },
      orderBy: [{ IPouts: "desc" }],
    }),
    prisma.managers.findFirst({
      where: { teamID: teamId, yearID: year },
      include: { player: { select: { nameFirst: true, nameLast: true, nameGiven: true } } },
    }),
  ]);

  return { team, batters, pitchers, manager };
}

export default async function TeamSeasonPage({ params }: Props) {
  const { teamId, year: yearStr } = await params;
  const year = parseInt(yearStr);
  const data = await getTeamData(teamId, year);

  if (!data) notFound();

  const { team, batters, pitchers, manager } = data;
  const pythWin = pythagoreanWinPct(team.R || 0, team.RA || 0);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Team Header */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              {team.lgID} {team.divID ? `${team.divID === "E" ? "East" : team.divID === "C" ? "Central" : "West"}` : ""}
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
              {team.name}{" "}
              <span className="text-muted">{year}</span>
            </h1>
            {manager?.player && (
              <p className="text-sm text-muted mt-1">
                Manager: {fullName(manager.player.nameFirst, manager.player.nameLast, manager.player.nameGiven)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {team.Rank && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Finish
                </span>{" "}
                {ordinal(team.Rank)}
              </span>
            )}
            {team.park && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Park
                </span>{" "}
                {team.park}
              </span>
            )}
            {team.attendance && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Attendance
                </span>{" "}
                {fmtInt(team.attendance)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-8">
          <StatCard
            label="Record"
            value={fmtRecord(team.W || 0, team.L || 0)}
            sub={fmtWinPct(team.W || 0, team.L || 0)}
          />
          <StatCard label="Runs" value={fmtInt(team.R)} />
          <StatCard label="Runs Allowed" value={fmtInt(team.RA)} />
          {team.ERA && (
            <StatCard label="Team ERA" value={fmtEra(team.ERA)} />
          )}
          {pythWin !== null && (
            <StatCard
              label="Pythag W-L"
              value={`${Math.round(pythWin * (team.G || 162))}-${Math.round((1 - pythWin) * (team.G || 162))}`}
            />
          )}
          {(team.WSWin === "Y" || team.LgWin === "Y" || team.DivWin === "Y" || team.WCWin === "Y") && (
            <StatCard
              label="Postseason"
              value={
                team.WSWin === "Y"
                  ? "WS Champs"
                  : team.LgWin === "Y"
                    ? "Pennant"
                    : team.DivWin === "Y"
                      ? "Div Winners"
                      : "Wild Card"
              }
            />
          )}
        </div>
      </section>

      {/* Team Batting */}
      {batters.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Batting
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Player", "G", "PA", "AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "BB", "SO", "BA", "OBP", "SLG", "OPS"].map(
                      (col) => (
                        <th
                          key={col}
                          className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                          ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {batters.map((row) => {
                    const pa = plateAppearances(row.AB || 0, row.BB || 0, row.HBP || 0, row.SH || 0, row.SF || 0);
                    const avg = battingAvg(row.H || 0, row.AB || 0);
                    const obp = onBasePct(row.H || 0, row.BB || 0, row.HBP || 0, row.AB || 0, row.SF || 0);
                    const slg = sluggingPct(row.H || 0, row.doubles || 0, row.triples || 0, row.HR || 0, row.AB || 0);
                    return (
                      <tr key={`${row.playerID}-${row.stint}`}>
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/players/${row.playerID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {fullName(row.player.nameFirst, row.player.nameLast, row.player.nameGiven)}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.G}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{pa}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.AB}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.R}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{row.H}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.doubles}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.triples}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{row.HR}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.RBI}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.SB}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.BB}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.SO}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{fmtAvg(avg)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtAvg(obp)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtAvg(slg)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{fmtAvg(ops(obp, slg))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Team Pitching */}
      {pitchers.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Pitching
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Player", "W", "L", "ERA", "G", "GS", "SV", "IP", "H", "R", "ER", "HR", "BB", "SO", "WHIP", "SO/9"].map(
                      (col) => (
                        <th
                          key={col}
                          className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                          ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {pitchers.map((row) => {
                    const ip = row.IPouts || 0;
                    const eraVal = era(row.ER || 0, ip);
                    const whipVal = whip(row.BB || 0, row.H || 0, ip);
                    const so9 = perNine(row.SO || 0, ip);
                    return (
                      <tr key={`${row.playerID}-${row.stint}`}>
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/players/${row.playerID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {fullName(row.player.nameFirst, row.player.nameLast, row.player.nameGiven)}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.W}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.L}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{fmtEra(eraVal)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.G}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.GS}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.SV}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{inningsPitchedDisplay(ip)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.H}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.R}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.ER}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.HR}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.BB}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{row.SO}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtEra(whipVal)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{so9 !== null ? so9.toFixed(1) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
