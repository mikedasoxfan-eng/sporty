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
  fieldingPct,
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

  const retroCode = team.teamIDretro || teamId;

  const [
    batters,
    pitchers,
    manager,
    prevTeam,
    nextTeam,
    appearances,
    fielding,
    gameLogs,
    battingPost,
    pitchingPost,
  ] = await Promise.all([
    prisma.batting.findMany({
      where: { teamID: teamId, yearID: year },
      include: {
        player: {
          select: {
            nameFirst: true,
            nameLast: true,
            nameGiven: true,
            nameSuffix: true,
            birthYear: true,
          },
        },
      },
      orderBy: [{ AB: "desc" }],
    }),
    prisma.pitching.findMany({
      where: { teamID: teamId, yearID: year },
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
      orderBy: [{ IPouts: "desc" }],
    }),
    prisma.managers.findFirst({
      where: { teamID: teamId, yearID: year },
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
    }),
    prisma.teams.findFirst({
      where: { teamID: teamId, yearID: year - 1 },
      select: { teamID: true, yearID: true },
    }),
    prisma.teams.findFirst({
      where: { teamID: teamId, yearID: year + 1 },
      select: { teamID: true, yearID: true },
    }),
    prisma.appearances.findMany({
      where: { teamID: teamId, yearID: year },
      include: {
        player: {
          select: {
            nameFirst: true,
            nameLast: true,
            nameGiven: true,
            nameSuffix: true,
            birthYear: true,
          },
        },
      },
      orderBy: [{ G_all: "desc" }],
    }),
    prisma.fielding.findMany({
      where: { teamID: teamId, yearID: year },
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
      orderBy: [{ POS: "asc" }, { G: "desc" }],
    }),
    prisma.gameLog.findMany({
      where: {
        OR: [
          { homeTeam: retroCode, date: { startsWith: String(year) } },
          { visitingTeam: retroCode, date: { startsWith: String(year) } },
        ],
      },
      orderBy: [{ date: "asc" }, { gameNumber: "asc" }],
    }),
    prisma.battingPost.findMany({
      where: { teamID: teamId, yearID: year },
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
      orderBy: [{ AB: "desc" }],
    }),
    prisma.pitchingPost.findMany({
      where: { teamID: teamId, yearID: year },
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
      orderBy: [{ IPouts: "desc" }],
    }),
  ]);

  return {
    team,
    batters,
    pitchers,
    manager,
    prevTeam,
    nextTeam,
    appearances,
    fielding,
    gameLogs,
    battingPost,
    pitchingPost,
    retroCode,
  };
}

function sumBatters(batters: { G?: number | null; AB?: number | null; R?: number | null; H?: number | null; doubles?: number | null; triples?: number | null; HR?: number | null; RBI?: number | null; SB?: number | null; BB?: number | null; SO?: number | null; HBP?: number | null; SH?: number | null; SF?: number | null }[]) {
  const s = {
    G: 0, AB: 0, R: 0, H: 0, doubles: 0, triples: 0, HR: 0,
    RBI: 0, SB: 0, BB: 0, SO: 0, HBP: 0, SH: 0, SF: 0,
  };
  for (const r of batters) {
    s.G += r.G || 0;
    s.AB += r.AB || 0;
    s.R += r.R || 0;
    s.H += r.H || 0;
    s.doubles += r.doubles || 0;
    s.triples += r.triples || 0;
    s.HR += r.HR || 0;
    s.RBI += r.RBI || 0;
    s.SB += r.SB || 0;
    s.BB += r.BB || 0;
    s.SO += r.SO || 0;
    s.HBP += r.HBP || 0;
    s.SH += r.SH || 0;
    s.SF += r.SF || 0;
  }
  return s;
}

function sumPitchers(pitchers: { W?: number | null; L?: number | null; G?: number | null; GS?: number | null; SV?: number | null; IPouts?: number | null; H?: number | null; R?: number | null; ER?: number | null; HR?: number | null; BB?: number | null; SO?: number | null }[]) {
  const s = {
    W: 0, L: 0, G: 0, GS: 0, SV: 0, IPouts: 0, H: 0,
    R: 0, ER: 0, HR: 0, BB: 0, SO: 0,
  };
  for (const r of pitchers) {
    s.W += r.W || 0;
    s.L += r.L || 0;
    s.G += r.G || 0;
    s.GS += r.GS || 0;
    s.SV += r.SV || 0;
    s.IPouts += r.IPouts || 0;
    s.H += r.H || 0;
    s.R += r.R || 0;
    s.ER += r.ER || 0;
    s.HR += r.HR || 0;
    s.BB += r.BB || 0;
    s.SO += r.SO || 0;
  }
  return s;
}

// Aggregate postseason batting rows by player (across rounds)
function aggregatePostBatting(rows: Array<{
  playerID: string;
  round: string;
  teamID?: string | null;
  G?: number | null;
  AB?: number | null;
  R?: number | null;
  H?: number | null;
  doubles?: number | null;
  triples?: number | null;
  HR?: number | null;
  RBI?: number | null;
  SB?: number | null;
  BB?: number | null;
  SO?: number | null;
  HBP?: number | null;
  SH?: number | null;
  SF?: number | null;
  player: { nameFirst: string | null; nameLast: string | null; nameGiven: string | null; nameSuffix: string | null };
}>) {
  const map = new Map<string, {
    playerID: string;
    player: { nameFirst: string | null; nameLast: string | null; nameGiven: string | null; nameSuffix: string | null };
    G: number; AB: number; R: number; H: number; doubles: number; triples: number; HR: number;
    RBI: number; SB: number; BB: number; SO: number; HBP: number; SH: number; SF: number;
  }>();
  for (const r of rows) {
    const existing = map.get(r.playerID);
    if (existing) {
      existing.G += r.G || 0;
      existing.AB += r.AB || 0;
      existing.R += r.R || 0;
      existing.H += r.H || 0;
      existing.doubles += r.doubles || 0;
      existing.triples += r.triples || 0;
      existing.HR += r.HR || 0;
      existing.RBI += r.RBI || 0;
      existing.SB += r.SB || 0;
      existing.BB += r.BB || 0;
      existing.SO += r.SO || 0;
      existing.HBP += r.HBP || 0;
      existing.SH += r.SH || 0;
      existing.SF += r.SF || 0;
    } else {
      map.set(r.playerID, {
        playerID: r.playerID,
        player: r.player,
        G: r.G || 0, AB: r.AB || 0, R: r.R || 0, H: r.H || 0,
        doubles: r.doubles || 0, triples: r.triples || 0, HR: r.HR || 0,
        RBI: r.RBI || 0, SB: r.SB || 0, BB: r.BB || 0, SO: r.SO || 0,
        HBP: r.HBP || 0, SH: r.SH || 0, SF: r.SF || 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.AB - a.AB);
}

// Aggregate postseason pitching rows by player (across rounds)
function aggregatePostPitching(rows: Array<{
  playerID: string;
  round: string;
  teamID?: string | null;
  W?: number | null;
  L?: number | null;
  G?: number | null;
  GS?: number | null;
  SV?: number | null;
  IPouts?: number | null;
  H?: number | null;
  R?: number | null;
  ER?: number | null;
  HR?: number | null;
  BB?: number | null;
  SO?: number | null;
  player: { nameFirst: string | null; nameLast: string | null; nameGiven: string | null; nameSuffix: string | null };
}>) {
  const map = new Map<string, {
    playerID: string;
    player: { nameFirst: string | null; nameLast: string | null; nameGiven: string | null; nameSuffix: string | null };
    W: number; L: number; G: number; GS: number; SV: number; IPouts: number;
    H: number; R: number; ER: number; HR: number; BB: number; SO: number;
  }>();
  for (const r of rows) {
    const existing = map.get(r.playerID);
    if (existing) {
      existing.W += r.W || 0;
      existing.L += r.L || 0;
      existing.G += r.G || 0;
      existing.GS += r.GS || 0;
      existing.SV += r.SV || 0;
      existing.IPouts += r.IPouts || 0;
      existing.H += r.H || 0;
      existing.R += r.R || 0;
      existing.ER += r.ER || 0;
      existing.HR += r.HR || 0;
      existing.BB += r.BB || 0;
      existing.SO += r.SO || 0;
    } else {
      map.set(r.playerID, {
        playerID: r.playerID,
        player: r.player,
        W: r.W || 0, L: r.L || 0, G: r.G || 0, GS: r.GS || 0,
        SV: r.SV || 0, IPouts: r.IPouts || 0, H: r.H || 0,
        R: r.R || 0, ER: r.ER || 0, HR: r.HR || 0,
        BB: r.BB || 0, SO: r.SO || 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.IPouts - a.IPouts);
}

export default async function TeamSeasonPage({ params }: Props) {
  const { teamId, year: yearStr } = await params;
  const year = parseInt(yearStr);
  const data = await getTeamData(teamId, year);

  if (!data) notFound();

  const {
    team,
    batters,
    pitchers,
    manager,
    prevTeam,
    nextTeam,
    appearances,
    fielding,
    gameLogs,
    battingPost,
    pitchingPost,
    retroCode,
  } = data;

  const pythWin = pythagoreanWinPct(team.R || 0, team.RA || 0);

  // Batting totals
  const bt = sumBatters(batters);
  const btPa = plateAppearances(bt.AB, bt.BB, bt.HBP, bt.SH, bt.SF);
  const btAvg = battingAvg(bt.H, bt.AB);
  const btObp = onBasePct(bt.H, bt.BB, bt.HBP, bt.AB, bt.SF);
  const btSlg = sluggingPct(bt.H, bt.doubles, bt.triples, bt.HR, bt.AB);

  // Pitching totals
  const pt = sumPitchers(pitchers);
  const ptEra = era(pt.ER, pt.IPouts);
  const ptWhip = whip(pt.BB, pt.H, pt.IPouts);
  const ptSo9 = perNine(pt.SO, pt.IPouts);

  // Postseason aggregated
  const postBatters = aggregatePostBatting(battingPost);
  const postPitchers = aggregatePostPitching(pitchingPost);

  // Build schedule
  const schedule = gameLogs.map((g) => {
    const isHome = g.homeTeam === retroCode;
    const opponent = isHome ? g.visitingTeam : g.homeTeam;
    const teamScore = isHome ? g.homeScore : g.visitingScore;
    const oppScore = isHome ? g.visitingScore : g.homeScore;
    const won = teamScore !== null && oppScore !== null && teamScore > oppScore;
    const lost = teamScore !== null && oppScore !== null && teamScore < oppScore;
    const dateStr = g.date;
    const formatted = dateStr.length === 8
      ? `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`
      : dateStr;
    return {
      date: formatted,
      rawDate: dateStr,
      gameNumber: g.gameNumber,
      isHome,
      opponent: opponent || "???",
      teamScore: teamScore ?? 0,
      oppScore: oppScore ?? 0,
      won,
      lost,
    };
  });

  // Running record
  let runW = 0;
  let runL = 0;
  const scheduleWithRecord = schedule.map((g) => {
    if (g.won) runW++;
    if (g.lost) runL++;
    return { ...g, record: `${runW}-${runL}` };
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Team Header */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              {team.lgID}{" "}
              {team.divID
                ? `${team.divID === "E" ? "East" : team.divID === "C" ? "Central" : "West"}`
                : ""}
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
              {team.name}{" "}
              <span className="text-muted">{year}</span>
            </h1>
            {manager?.player && (
              <p className="text-sm text-muted mt-1">
                Manager:{" "}
                {fullName(
                  manager.player.nameFirst,
                  manager.player.nameLast,
                  manager.player.nameGiven,
                  manager.player.nameSuffix
                )}
              </p>
            )}
            {/* Prev/Next Navigation */}
            <div className="mt-3 flex gap-3">
              {prevTeam && (
                <Link
                  href={`/baseball/teams/${prevTeam.teamID}/${prevTeam.yearID}`}
                  className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
                >
                  &larr; {year - 1}
                </Link>
              )}
              {nextTeam && (
                <Link
                  href={`/baseball/teams/${nextTeam.teamID}/${nextTeam.yearID}`}
                  className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
                >
                  {year + 1} &rarr;
                </Link>
              )}
            </div>
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
          {team.BPF !== null && team.BPF !== undefined && (
            <StatCard label="BPF" value={String(team.BPF)} sub="Batter Park Factor" />
          )}
          {team.PPF !== null && team.PPF !== undefined && (
            <StatCard label="PPF" value={String(team.PPF)} sub="Pitcher Park Factor" />
          )}
          {(team.WSWin === "Y" ||
            team.LgWin === "Y" ||
            team.DivWin === "Y" ||
            team.WCWin === "Y") && (
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
                    {[
                      "Player",
                      "G",
                      "PA",
                      "AB",
                      "R",
                      "H",
                      "2B",
                      "3B",
                      "HR",
                      "RBI",
                      "SB",
                      "BB",
                      "SO",
                      "BA",
                      "OBP",
                      "SLG",
                      "OPS",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                        ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {batters.map((row) => {
                    const pa = plateAppearances(
                      row.AB || 0,
                      row.BB || 0,
                      row.HBP || 0,
                      row.SH || 0,
                      row.SF || 0
                    );
                    const avg = battingAvg(row.H || 0, row.AB || 0);
                    const obp = onBasePct(
                      row.H || 0,
                      row.BB || 0,
                      row.HBP || 0,
                      row.AB || 0,
                      row.SF || 0
                    );
                    const slg = sluggingPct(
                      row.H || 0,
                      row.doubles || 0,
                      row.triples || 0,
                      row.HR || 0,
                      row.AB || 0
                    );
                    return (
                      <tr key={`${row.playerID}-${row.stint}`}>
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/players/${row.playerID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {fullName(
                              row.player.nameFirst,
                              row.player.nameLast,
                              row.player.nameGiven,
                              row.player.nameSuffix
                            )}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {pa}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.AB}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.R}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {row.H}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.doubles}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.triples}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {row.HR}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.RBI}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SB}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.BB}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SO}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {fmtAvg(avg)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {fmtAvg(obp)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {fmtAvg(slg)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {fmtAvg(ops(obp, slg))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-surface-alt">
                    <td className="py-2 px-2.5 text-left sticky left-0 z-10 bg-surface-alt">
                      Team Totals
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {team.G}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {btPa}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.AB}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.R}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.H}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.doubles}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.triples}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.HR}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.RBI}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.SB}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.BB}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {bt.SO}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtAvg(btAvg)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtAvg(btObp)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtAvg(btSlg)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtAvg(ops(btObp, btSlg))}
                    </td>
                  </tr>
                </tfoot>
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
                    {[
                      "Player",
                      "W",
                      "L",
                      "ERA",
                      "G",
                      "GS",
                      "SV",
                      "IP",
                      "H",
                      "R",
                      "ER",
                      "HR",
                      "BB",
                      "SO",
                      "WHIP",
                      "SO/9",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                        ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                      >
                        {col}
                      </th>
                    ))}
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
                            {fullName(
                              row.player.nameFirst,
                              row.player.nameLast,
                              row.player.nameGiven,
                              row.player.nameSuffix
                            )}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.W}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.L}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {fmtEra(eraVal)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.GS}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SV}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {inningsPitchedDisplay(ip)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.H}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.R}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.ER}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.HR}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.BB}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {row.SO}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {fmtEra(whipVal)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {so9 !== null ? so9.toFixed(1) : "\u2014"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-surface-alt">
                    <td className="py-2 px-2.5 text-left sticky left-0 z-10 bg-surface-alt">
                      Team Totals
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.W}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.L}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtEra(ptEra)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.G}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.GS}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.SV}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {inningsPitchedDisplay(pt.IPouts)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.H}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.R}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.ER}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.HR}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.BB}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {pt.SO}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtEra(ptWhip)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {ptSo9 !== null ? ptSo9.toFixed(1) : "\u2014"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Roster & Appearances */}
      {appearances.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Roster &amp; Appearances
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Player",
                      "Age",
                      "G",
                      "GS",
                      "Batting",
                      "Defense",
                      "P",
                      "C",
                      "1B",
                      "2B",
                      "3B",
                      "SS",
                      "LF",
                      "CF",
                      "RF",
                      "OF",
                      "DH",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                        ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {appearances.map((row) => {
                    const age = row.player.birthYear
                      ? year - row.player.birthYear
                      : null;
                    return (
                      <tr key={row.playerID}>
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/players/${row.playerID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {fullName(
                              row.player.nameFirst,
                              row.player.nameLast,
                              row.player.nameGiven,
                              row.player.nameSuffix
                            )}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {age ?? "\u2014"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_all}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.GS}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_batting}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_defense}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_p}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_c}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_1b}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_2b}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_3b}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_ss}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_lf}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_cf}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_rf}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_of}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G_dh}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Fielding */}
      {fielding.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Fielding
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Player",
                      "POS",
                      "G",
                      "GS",
                      "PO",
                      "A",
                      "E",
                      "DP",
                      "FldPct",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                        ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : col === "POS" ? "text-left" : "text-right"}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {fielding.map((row) => {
                    const fp = fieldingPct(
                      row.PO || 0,
                      row.A || 0,
                      row.E || 0
                    );
                    return (
                      <tr
                        key={`${row.playerID}-${row.stint}-${row.POS}`}
                      >
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/players/${row.playerID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {fullName(
                              row.player.nameFirst,
                              row.player.nameLast,
                              row.player.nameGiven,
                              row.player.nameSuffix
                            )}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-left font-mono text-xs">
                          {row.POS}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.GS}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.PO}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.A}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.E}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.DP}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {fmtAvg(fp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Schedule & Results */}
      {scheduleWithRecord.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Schedule &amp; Results
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Date", "Opponent", "Score", "W/L", "Record"].map(
                      (col) => (
                        <th
                          key={col}
                          className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                          ${col === "Date" || col === "Opponent" ? "text-left" : "text-right"}`}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {scheduleWithRecord.map((g, i) => (
                    <tr key={`${g.rawDate}-${g.gameNumber}-${i}`}>
                      <td className="py-2 px-2.5 text-left font-mono text-xs">
                        {g.date}
                      </td>
                      <td className="py-2 px-2.5 text-left text-xs">
                        {g.isHome ? "" : "@ "}
                        {g.opponent}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-xs">
                        {g.teamScore}-{g.oppScore}
                      </td>
                      <td
                        className={`py-2 px-2.5 text-right font-mono text-xs font-medium ${
                          g.won
                            ? "text-green-600 dark:text-green-400"
                            : g.lost
                              ? "text-red-600 dark:text-red-400"
                              : ""
                        }`}
                      >
                        {g.won ? "W" : g.lost ? "L" : "T"}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-xs text-muted">
                        {g.record}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Postseason Batting */}
      {postBatters.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Postseason Batting
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Player",
                      "G",
                      "PA",
                      "AB",
                      "R",
                      "H",
                      "2B",
                      "3B",
                      "HR",
                      "RBI",
                      "SB",
                      "BB",
                      "SO",
                      "BA",
                      "OBP",
                      "SLG",
                      "OPS",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                        ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {postBatters.map((row) => {
                    const pa = plateAppearances(
                      row.AB,
                      row.BB,
                      row.HBP,
                      row.SH,
                      row.SF
                    );
                    const avg = battingAvg(row.H, row.AB);
                    const obp = onBasePct(
                      row.H,
                      row.BB,
                      row.HBP,
                      row.AB,
                      row.SF
                    );
                    const slg = sluggingPct(
                      row.H,
                      row.doubles,
                      row.triples,
                      row.HR,
                      row.AB
                    );
                    return (
                      <tr key={row.playerID}>
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/players/${row.playerID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {fullName(
                              row.player.nameFirst,
                              row.player.nameLast,
                              row.player.nameGiven,
                              row.player.nameSuffix
                            )}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {pa}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.AB}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.R}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {row.H}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.doubles}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.triples}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {row.HR}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.RBI}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SB}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.BB}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SO}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {fmtAvg(avg)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {fmtAvg(obp)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {fmtAvg(slg)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {fmtAvg(ops(obp, slg))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Postseason Pitching */}
      {postPitchers.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Postseason Pitching
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Player",
                      "W",
                      "L",
                      "ERA",
                      "G",
                      "GS",
                      "SV",
                      "IP",
                      "H",
                      "R",
                      "ER",
                      "HR",
                      "BB",
                      "SO",
                      "WHIP",
                      "SO/9",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                        ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : "text-right"}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {postPitchers.map((row) => {
                    const eraVal = era(row.ER, row.IPouts);
                    const whipVal = whip(row.BB, row.H, row.IPouts);
                    const so9 = perNine(row.SO, row.IPouts);
                    return (
                      <tr key={row.playerID}>
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/players/${row.playerID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {fullName(
                              row.player.nameFirst,
                              row.player.nameLast,
                              row.player.nameGiven,
                              row.player.nameSuffix
                            )}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.W}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.L}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {fmtEra(eraVal)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.G}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.GS}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SV}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {inningsPitchedDisplay(row.IPouts)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.H}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.R}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.ER}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.HR}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.BB}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                          {row.SO}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {fmtEra(whipVal)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {so9 !== null ? so9.toFixed(1) : "\u2014"}
                        </td>
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
