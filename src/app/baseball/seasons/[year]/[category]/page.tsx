import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtAvg, fmtEra, fmtIP, fullName } from "@/lib/format";
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
} from "@/lib/stats";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ year: string; category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, category } = await params;
  const catLabel = category === "batting" ? "Batting" : "Pitching";
  return { title: `${year} ${catLabel} Leaders` };
}

async function getBattingLeaders(year: number) {
  return prisma.batting.findMany({
    where: { yearID: year, AB: { gte: 50 } },
    include: { player: { select: { nameFirst: true, nameLast: true, nameGiven: true } } },
    orderBy: [{ AB: "desc" }],
  });
}

async function getPitchingLeaders(year: number) {
  return prisma.pitching.findMany({
    where: { yearID: year, IPouts: { gte: 30 } },
    include: { player: { select: { nameFirst: true, nameLast: true, nameGiven: true } } },
    orderBy: [{ IPouts: "desc" }],
  });
}

export default async function LeadersPage({ params }: Props) {
  const { year: yearStr, category } = await params;
  const year = parseInt(yearStr);

  if (!["batting", "pitching"].includes(category)) notFound();

  const isBatting = category === "batting";

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/baseball"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Baseball
          </Link>
          <span className="text-xs text-muted-light">/</span>
          <Link
            href={`/baseball/seasons/${year}`}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            {year}
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {year}{" "}
          <span className="text-muted">
            {isBatting ? "Batting" : "Pitching"} Leaders
          </span>
        </h1>
        <div className="mt-4 flex gap-2">
          <Link
            href={`/baseball/seasons/${year}/batting`}
            className={`text-sm px-3 py-1.5 border rounded-md transition-colors ${
              isBatting
                ? "border-accent bg-accent/5 text-accent"
                : "border-border hover:bg-surface-alt text-muted"
            }`}
          >
            Batting
          </Link>
          <Link
            href={`/baseball/seasons/${year}/pitching`}
            className={`text-sm px-3 py-1.5 border rounded-md transition-colors ${
              !isBatting
                ? "border-accent bg-accent/5 text-accent"
                : "border-border hover:bg-surface-alt text-muted"
            }`}
          >
            Pitching
          </Link>
        </div>
      </div>

      {isBatting ? (
        <BattingTable year={year} />
      ) : (
        <PitchingTable year={year} />
      )}
    </div>
  );
}

async function BattingTable({ year }: { year: number }) {
  const batters = await getBattingLeaders(year);

  if (batters.length === 0) {
    return (
      <p className="text-muted text-sm">No batting data found for {year}.</p>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="stat-scroll overflow-x-auto">
        <table className="stat-table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {[
                "#",
                "Player",
                "Team",
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
                "CS",
                "BB",
                "SO",
                "BA",
                "OBP",
                "SLG",
                "OPS",
                "TB",
                "GIDP",
                "HBP",
                "SF",
                "IBB",
              ].map((col) => (
                <th
                  key={col}
                  className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                    ${["#", "Player", "Team"].includes(col) ? "text-left" : "text-right"}
                    ${col === "Player" ? "sticky left-0 z-20 bg-surface" : ""}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {batters.map((row, i) => {
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
              const tb = totalBases(
                row.H || 0,
                row.doubles || 0,
                row.triples || 0,
                row.HR || 0
              );

              return (
                <tr key={`${row.playerID}-${row.stint}`}>
                  <td className="py-2 px-2.5 text-left text-xs text-muted font-mono">
                    {i + 1}
                  </td>
                  <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                    <Link
                      href={`/baseball/players/${row.playerID}`}
                      className="text-link hover:text-link-hover hover:underline transition-colors"
                    >
                      {fullName(row.player.nameFirst, row.player.nameLast, row.player.nameGiven)}
                    </Link>
                  </td>
                  <td className="py-2 px-2.5 text-left text-muted">
                    <Link
                      href={`/baseball/teams/${row.teamID}/${year}`}
                      className="hover:text-foreground transition-colors"
                    >
                      {row.teamID}
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
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.CS}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.BB}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.SO}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{fmtAvg(avg)}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtAvg(obp)}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtAvg(slg)}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{fmtAvg(ops(obp, slg))}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{tb}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.GIDP}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.HBP}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.SF}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.IBB}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function PitchingTable({ year }: { year: number }) {
  const pitchers = await getPitchingLeaders(year);

  if (pitchers.length === 0) {
    return (
      <p className="text-muted text-sm">
        No pitching data found for {year}.
      </p>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="stat-scroll overflow-x-auto">
        <table className="stat-table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {[
                "#",
                "Player",
                "Team",
                "W",
                "L",
                "ERA",
                "G",
                "GS",
                "CG",
                "SHO",
                "SV",
                "IP",
                "H",
                "R",
                "ER",
                "HR",
                "BB",
                "SO",
                "WHIP",
                "H/9",
                "BB/9",
                "SO/9",
                "SO/BB",
              ].map((col) => (
                <th
                  key={col}
                  className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                    ${["#", "Player", "Team"].includes(col) ? "text-left" : "text-right"}
                    ${col === "Player" ? "sticky left-0 z-20 bg-surface" : ""}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {pitchers.map((row, i) => {
              const ip = row.IPouts || 0;
              const eraVal = era(row.ER || 0, ip);
              const whipVal = whip(row.BB || 0, row.H || 0, ip);
              const h9 = perNine(row.H || 0, ip);
              const bb9 = perNine(row.BB || 0, ip);
              const so9 = perNine(row.SO || 0, ip);
              const soBb =
                row.BB && row.BB > 0
                  ? ((row.SO || 0) / row.BB).toFixed(2)
                  : "—";

              return (
                <tr key={`${row.playerID}-${row.stint}`}>
                  <td className="py-2 px-2.5 text-left text-xs text-muted font-mono">
                    {i + 1}
                  </td>
                  <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                    <Link
                      href={`/baseball/players/${row.playerID}`}
                      className="text-link hover:text-link-hover hover:underline transition-colors"
                    >
                      {fullName(row.player.nameFirst, row.player.nameLast, row.player.nameGiven)}
                    </Link>
                  </td>
                  <td className="py-2 px-2.5 text-left text-muted">
                    <Link
                      href={`/baseball/teams/${row.teamID}/${year}`}
                      className="hover:text-foreground transition-colors"
                    >
                      {row.teamID}
                    </Link>
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.W}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.L}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{fmtEra(eraVal)}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.G}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.GS}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.CG}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.SHO}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.SV}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{inningsPitchedDisplay(ip)}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.H}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.R}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.ER}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.HR}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{row.BB}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">{row.SO}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtEra(whipVal)}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{h9 !== null ? h9.toFixed(1) : "—"}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{bb9 !== null ? bb9.toFixed(1) : "—"}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{so9 !== null ? so9.toFixed(1) : "—"}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">{soBb}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
