import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  fmtAvg,
  fmtEra,
  fmtHeight,
  fmtInt,
  fmtIP,
  fmtSalary,
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
} from "@/lib/stats";
import { StatCard } from "@/components/ui/StatCard";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const player = await prisma.people.findUnique({
    where: { playerID: id },
    select: { nameFirst: true, nameLast: true, nameGiven: true, nameSuffix: true },
  });
  if (!player) return { title: "Player Not Found" };
  return { title: fullName(player.nameFirst, player.nameLast, player.nameGiven, player.nameSuffix) };
}

async function getPlayerData(id: string) {
  const player = await prisma.people.findUnique({
    where: { playerID: id },
  });

  if (!player) return null;

  const [batting, pitching, fielding, appearances, battingPost, pitchingPost, awards, allstar, salary, hallOfFame] =
    await Promise.all([
      prisma.batting.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }, { stint: "asc" }],
      }),
      prisma.pitching.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }, { stint: "asc" }],
      }),
      prisma.fielding.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }, { stint: "asc" }],
      }),
      prisma.appearances.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }],
      }),
      prisma.battingPost.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }],
      }),
      prisma.pitchingPost.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }],
      }),
      prisma.awardsPlayers.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }],
      }),
      prisma.allstarFull.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }],
      }),
      prisma.salaries.findMany({
        where: { playerID: id },
        orderBy: [{ yearID: "asc" }],
      }),
      prisma.hallOfFame.findMany({
        where: { playerID: id, inducted: "Y" },
      }),
    ]);

  return {
    player,
    batting,
    pitching,
    fielding,
    appearances,
    battingPost,
    pitchingPost,
    awards,
    allstar,
    salary,
    hallOfFame,
  };
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const data = await getPlayerData(id);

  if (!data) notFound();

  const { player, batting, pitching, fielding, appearances, battingPost, pitchingPost, awards, allstar, salary, hallOfFame } = data;

  const isBatter = batting.length > 0;
  const isPitcher = pitching.length > 0 && pitching.some((p) => (p.GS || 0) > 0 || (p.G || 0) > 5);
  const isHOF = hallOfFame.length > 0;
  const allStarCount = allstar.length;

  // Career batting totals
  const careerBatting = isBatter
    ? batting.reduce(
        (acc, row) => ({
          G: acc.G + (row.G || 0),
          AB: acc.AB + (row.AB || 0),
          R: acc.R + (row.R || 0),
          H: acc.H + (row.H || 0),
          doubles: acc.doubles + (row.doubles || 0),
          triples: acc.triples + (row.triples || 0),
          HR: acc.HR + (row.HR || 0),
          RBI: acc.RBI + (row.RBI || 0),
          SB: acc.SB + (row.SB || 0),
          CS: acc.CS + (row.CS || 0),
          BB: acc.BB + (row.BB || 0),
          SO: acc.SO + (row.SO || 0),
          IBB: acc.IBB + (row.IBB || 0),
          HBP: acc.HBP + (row.HBP || 0),
          SH: acc.SH + (row.SH || 0),
          SF: acc.SF + (row.SF || 0),
          GIDP: acc.GIDP + (row.GIDP || 0),
        }),
        { G: 0, AB: 0, R: 0, H: 0, doubles: 0, triples: 0, HR: 0, RBI: 0, SB: 0, CS: 0, BB: 0, SO: 0, IBB: 0, HBP: 0, SH: 0, SF: 0, GIDP: 0 }
      )
    : null;

  // Career pitching totals
  const careerPitching = isPitcher
    ? pitching.reduce(
        (acc, row) => ({
          W: acc.W + (row.W || 0),
          L: acc.L + (row.L || 0),
          G: acc.G + (row.G || 0),
          GS: acc.GS + (row.GS || 0),
          CG: acc.CG + (row.CG || 0),
          SHO: acc.SHO + (row.SHO || 0),
          SV: acc.SV + (row.SV || 0),
          IPouts: acc.IPouts + (row.IPouts || 0),
          H: acc.H + (row.H || 0),
          ER: acc.ER + (row.ER || 0),
          HR: acc.HR + (row.HR || 0),
          BB: acc.BB + (row.BB || 0),
          SO: acc.SO + (row.SO || 0),
          R: acc.R + (row.R || 0),
          HBP: acc.HBP + (row.HBP || 0),
          BFP: acc.BFP + (row.BFP || 0),
        }),
        { W: 0, L: 0, G: 0, GS: 0, CG: 0, SHO: 0, SV: 0, IPouts: 0, H: 0, ER: 0, HR: 0, BB: 0, SO: 0, R: 0, HBP: 0, BFP: 0 }
      )
    : null;

  // Determine primary position from fielding
  const positionCounts: Record<string, number> = {};
  for (const f of fielding) {
    if (f.POS && f.POS !== "DH") {
      positionCounts[f.POS] = (positionCounts[f.POS] || 0) + (f.G || 0);
    }
  }
  const primaryPosition =
    Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "DH";

  // Unique years
  const years = [...new Set(batting.map((b) => b.yearID))];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Player Header */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">
                {primaryPosition}
              </span>
              {isHOF && (
                <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md dark:bg-amber-900/30 dark:text-amber-400">
                  Hall of Fame
                </span>
              )}
              {allStarCount > 0 && (
                <span className="text-xs text-muted">
                  {allStarCount}x All-Star
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
              {fullName(player.nameFirst, player.nameLast, player.nameGiven, player.nameSuffix)}
            </h1>
            {player.nameGiven &&
              player.nameGiven !==
                `${player.nameFirst} ${player.nameLast}` && (
                <p className="text-sm text-muted mt-1">{player.nameGiven}</p>
              )}
          </div>

          {/* Bio info */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {player.bats && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Bats
                </span>{" "}
                {player.bats === "R" ? "Right" : player.bats === "L" ? "Left" : "Both"}
              </span>
            )}
            {player.throws && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Throws
                </span>{" "}
                {player.throws === "R" ? "Right" : "Left"}
              </span>
            )}
            {player.height && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Height
                </span>{" "}
                {fmtHeight(player.height)}
              </span>
            )}
            {player.weight && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Weight
                </span>{" "}
                {player.weight} lb
              </span>
            )}
            {player.birthYear && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Born
                </span>{" "}
                {player.birthYear}
                {player.birthCity && `, ${player.birthCity}`}
                {player.birthState && `, ${player.birthState}`}
              </span>
            )}
            {player.debut && (
              <span>
                <span className="text-xs uppercase tracking-wider text-muted-light">
                  Debut
                </span>{" "}
                {player.debut}
              </span>
            )}
          </div>
        </div>

        {/* Career stat highlights */}
        <div className="mt-8 flex flex-wrap gap-8">
          {careerBatting && (
            <>
              <StatCard
                label="AVG"
                value={fmtAvg(battingAvg(careerBatting.H, careerBatting.AB))}
              />
              <StatCard label="HR" value={fmtInt(careerBatting.HR)} />
              <StatCard label="RBI" value={fmtInt(careerBatting.RBI)} />
              <StatCard label="H" value={fmtInt(careerBatting.H)} />
              <StatCard
                label="OPS"
                value={fmtAvg(
                  ops(
                    onBasePct(
                      careerBatting.H,
                      careerBatting.BB,
                      careerBatting.HBP,
                      careerBatting.AB,
                      careerBatting.SF
                    ),
                    sluggingPct(
                      careerBatting.H,
                      careerBatting.doubles,
                      careerBatting.triples,
                      careerBatting.HR,
                      careerBatting.AB
                    )
                  )
                )}
              />
              <StatCard label="SB" value={fmtInt(careerBatting.SB)} />
            </>
          )}
          {careerPitching && (
            <>
              <StatCard
                label="ERA"
                value={fmtEra(era(careerPitching.ER, careerPitching.IPouts))}
              />
              <StatCard
                label="W-L"
                value={`${careerPitching.W}-${careerPitching.L}`}
              />
              <StatCard label="SO" value={fmtInt(careerPitching.SO)} />
              <StatCard
                label="IP"
                value={fmtIP(careerPitching.IPouts)}
              />
              <StatCard
                label="WHIP"
                value={fmtEra(
                  whip(careerPitching.BB, careerPitching.H, careerPitching.IPouts)
                )}
              />
            </>
          )}
        </div>
      </section>

      {/* Awards section */}
      {awards.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
            Awards
          </h2>
          <div className="flex flex-wrap gap-2">
            {awards.map((a, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 border border-border rounded-md bg-surface"
              >
                {a.awardID} ({a.yearID}
                {a.lgID ? `, ${a.lgID}` : ""})
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Standard Batting Table */}
      {isBatter && careerBatting && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Standard Batting
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Year",
                      "Team",
                      "Lg",
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
                      "SH",
                      "SF",
                      "IBB",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                          ${["Year", "Team", "Lg"].includes(col) ? "text-left" : "text-right"}
                          ${col === "Year" ? "sticky left-0 z-20 bg-surface" : ""}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {batting.map((row) => {
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
                    const opsVal = ops(obp, slg);
                    const tb = totalBases(
                      row.H || 0,
                      row.doubles || 0,
                      row.triples || 0,
                      row.HR || 0
                    );

                    return (
                      <tr key={`${row.yearID}-${row.stint}`}>
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/seasons/${row.yearID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {row.yearID}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-left">
                          <Link
                            href={`/baseball/teams/${row.teamID}/${row.yearID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {row.teamID}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-left text-muted">
                          {row.lgID}
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
                          {row.CS}
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
                          {fmtAvg(opsVal)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {tb}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.GIDP}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.HBP}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SH}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SF}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.IBB}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border font-medium">
                  <tr>
                    <td className="py-2 px-2.5 text-left sticky left-0 z-10 bg-surface">
                      {years.length} Yrs
                    </td>
                    <td className="py-2 px-2.5" colSpan={2}></td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.G}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {plateAppearances(
                        careerBatting.AB,
                        careerBatting.BB,
                        careerBatting.HBP,
                        careerBatting.SH,
                        careerBatting.SF
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.AB}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.R}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.H}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.doubles}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.triples}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.HR}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.RBI}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.SB}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.CS}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.BB}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.SO}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtAvg(
                        battingAvg(careerBatting.H, careerBatting.AB)
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtAvg(
                        onBasePct(
                          careerBatting.H,
                          careerBatting.BB,
                          careerBatting.HBP,
                          careerBatting.AB,
                          careerBatting.SF
                        )
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtAvg(
                        sluggingPct(
                          careerBatting.H,
                          careerBatting.doubles,
                          careerBatting.triples,
                          careerBatting.HR,
                          careerBatting.AB
                        )
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtAvg(
                        ops(
                          onBasePct(
                            careerBatting.H,
                            careerBatting.BB,
                            careerBatting.HBP,
                            careerBatting.AB,
                            careerBatting.SF
                          ),
                          sluggingPct(
                            careerBatting.H,
                            careerBatting.doubles,
                            careerBatting.triples,
                            careerBatting.HR,
                            careerBatting.AB
                          )
                        )
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {totalBases(
                        careerBatting.H,
                        careerBatting.doubles,
                        careerBatting.triples,
                        careerBatting.HR
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.GIDP}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.HBP}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.SH}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.SF}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerBatting.IBB}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Standard Pitching Table */}
      {isPitcher && careerPitching && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Standard Pitching
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Year",
                      "Team",
                      "Lg",
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
                      "HR/9",
                      "BB/9",
                      "SO/9",
                      "SO/BB",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                          ${["Year", "Team", "Lg"].includes(col) ? "text-left" : "text-right"}
                          ${col === "Year" ? "sticky left-0 z-20 bg-surface" : ""}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {pitching.map((row) => {
                    const ip = row.IPouts || 0;
                    const eraVal = era(row.ER || 0, ip);
                    const whipVal = whip(row.BB || 0, row.H || 0, ip);
                    const h9 = perNine(row.H || 0, ip);
                    const hr9 = perNine(row.HR || 0, ip);
                    const bb9 = perNine(row.BB || 0, ip);
                    const so9 = perNine(row.SO || 0, ip);
                    const soBb =
                      row.BB && row.BB > 0
                        ? ((row.SO || 0) / row.BB).toFixed(2)
                        : "—";

                    return (
                      <tr key={`${row.yearID}-${row.stint}`}>
                        <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                          <Link
                            href={`/baseball/seasons/${row.yearID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {row.yearID}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-left">
                          <Link
                            href={`/baseball/teams/${row.teamID}/${row.yearID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {row.teamID}
                          </Link>
                        </td>
                        <td className="py-2 px-2.5 text-left text-muted">
                          {row.lgID}
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
                          {row.CG}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {row.SHO}
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
                          {h9 !== null ? h9.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {hr9 !== null ? hr9.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {bb9 !== null ? bb9.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {so9 !== null ? so9.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">
                          {soBb}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border font-medium">
                  <tr>
                    <td className="py-2 px-2.5 text-left sticky left-0 z-10 bg-surface">
                      Career
                    </td>
                    <td className="py-2 px-2.5" colSpan={2}></td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.W}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.L}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtEra(
                        era(careerPitching.ER, careerPitching.IPouts)
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.G}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.GS}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.CG}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.SHO}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.SV}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {inningsPitchedDisplay(careerPitching.IPouts)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.H}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.R}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.ER}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.HR}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.BB}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {careerPitching.SO}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtEra(
                        whip(
                          careerPitching.BB,
                          careerPitching.H,
                          careerPitching.IPouts
                        )
                      )}
                    </td>
                    <td className="py-2 px-2.5" colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Postseason Batting */}
      {battingPost.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Postseason Batting
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Year", "Round", "Team", "G", "AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "SO", "BA", "OBP", "SLG", "OPS"].map(
                      (col) => (
                        <th
                          key={col}
                          className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                          ${["Year", "Round", "Team"].includes(col) ? "text-left" : "text-right"}`}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {battingPost.map((row, i) => {
                    const avg = battingAvg(row.H || 0, row.AB || 0);
                    const obpVal = onBasePct(row.H || 0, row.BB || 0, row.HBP || 0, row.AB || 0, row.SF || 0);
                    const slgVal = sluggingPct(row.H || 0, row.doubles || 0, row.triples || 0, row.HR || 0, row.AB || 0);
                    return (
                      <tr key={i}>
                        <td className="py-2 px-2.5 text-left font-medium">{row.yearID}</td>
                        <td className="py-2 px-2.5 text-left text-muted">{row.round}</td>
                        <td className="py-2 px-2.5 text-left">{row.teamID}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.G}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.AB}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.R}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.H}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.doubles}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.triples}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.HR}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.RBI}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.BB}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{row.SO}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtAvg(avg)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtAvg(obpVal)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtAvg(slgVal)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs">{fmtAvg(ops(obpVal, slgVal))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Salary History */}
      {salary.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Salary History
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider text-left">Year</th>
                    <th className="py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider text-left">Team</th>
                    <th className="py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider text-right">Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {salary.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 px-2.5 text-left font-medium">{s.yearID}</td>
                      <td className="py-2 px-2.5 text-left">{s.teamID}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-xs">
                        {fmtSalary(s.salary)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border font-medium">
                  <tr>
                    <td className="py-2 px-2.5 text-left" colSpan={2}>Career Total</td>
                    <td className="py-2 px-2.5 text-right font-mono text-xs">
                      {fmtSalary(salary.reduce((sum, s) => sum + (s.salary || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
