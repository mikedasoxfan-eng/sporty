import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getLeagueAverages, opsPlus, eraPlus } from "@/lib/league-averages";
import { fmtAvg, fmtEra, fmtIP, fmtPct, fullName } from "@/lib/format";
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
  babip,
  iso,
  kPct,
  bbPct,
} from "@/lib/stats";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ year: string; category: string }>;
  searchParams: Promise<{
    qualified?: string;
    sort?: string;
    role?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, category } = await params;
  const catLabel =
    category === "batting"
      ? "Batting"
      : category === "pitching"
        ? "Pitching"
        : "Advanced";
  return { title: `${year} ${catLabel} Leaders` };
}

async function getBattingLeaders(year: number, qualified: boolean) {
  const minPA = qualified ? 502 : 50;
  // We need AB >= some threshold; for qualified we use a generous AB filter and compute PA in code
  const rows = await prisma.batting.findMany({
    where: { yearID: year, AB: { gte: qualified ? 200 : 50 } },
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
  });
  if (qualified) {
    return rows.filter((r) => {
      const pa = plateAppearances(
        r.AB || 0,
        r.BB || 0,
        r.HBP || 0,
        r.SH || 0,
        r.SF || 0
      );
      return pa >= minPA;
    });
  }
  return rows;
}

async function getPitchingLeaders(
  year: number,
  qualified: boolean,
  role?: string
) {
  const minIPouts = qualified ? 486 : 30;
  const rows = await prisma.pitching.findMany({
    where: { yearID: year, IPouts: { gte: qualified ? 100 : 30 } },
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
  });

  let filtered = rows;
  if (qualified) {
    filtered = filtered.filter((r) => (r.IPouts || 0) >= minIPouts);
  }

  if (role === "starter") {
    filtered = filtered.filter(
      (r) => (r.GS || 0) > (r.G || 0) / 2
    );
  } else if (role === "reliever") {
    filtered = filtered.filter(
      (r) => (r.GS || 0) <= (r.G || 0) / 2
    );
  }

  return filtered;
}

async function getAdvancedLeaders(year: number, qualified: boolean) {
  const rows = await prisma.batting.findMany({
    where: { yearID: year, AB: { gte: qualified ? 200 : 50 } },
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
  });
  if (qualified) {
    return rows.filter((r) => {
      const pa = plateAppearances(
        r.AB || 0,
        r.BB || 0,
        r.HBP || 0,
        r.SH || 0,
        r.SF || 0
      );
      return pa >= 502;
    });
  }
  return rows;
}

async function getWARData(year: number) {
  const rows = await prisma.playerWAR.findMany({
    where: { yearID: year },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.playerID, r.WAR ?? 0);
  }
  return map;
}

type SortableRow = Record<string, unknown> & { _sortVal: number };

function sortRows<T>(
  rows: T[],
  getSortVal: (row: T) => number,
  desc: boolean = true
): T[] {
  return [...rows].sort((a, b) => {
    const va = getSortVal(a);
    const vb = getSortVal(b);
    return desc ? vb - va : va - vb;
  });
}

// Batting sort value extractor
function battingSortVal(
  row: {
    G?: number | null;
    AB?: number | null;
    R?: number | null;
    H?: number | null;
    doubles?: number | null;
    triples?: number | null;
    HR?: number | null;
    RBI?: number | null;
    SB?: number | null;
    CS?: number | null;
    BB?: number | null;
    SO?: number | null;
    HBP?: number | null;
    SH?: number | null;
    SF?: number | null;
    IBB?: number | null;
    GIDP?: number | null;
  },
  sort: string,
  opsPlusVal?: number | null
): number {
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

  const map: Record<string, number> = {
    PA: pa,
    G: row.G || 0,
    AB: row.AB || 0,
    R: row.R || 0,
    H: row.H || 0,
    "2B": row.doubles || 0,
    "3B": row.triples || 0,
    HR: row.HR || 0,
    RBI: row.RBI || 0,
    SB: row.SB || 0,
    CS: row.CS || 0,
    BB: row.BB || 0,
    SO: row.SO || 0,
    BA: avg ?? 0,
    OBP: obp ?? 0,
    SLG: slg ?? 0,
    OPS: opsVal ?? 0,
    "OPS+": opsPlusVal ?? 0,
    TB: tb,
    GIDP: row.GIDP || 0,
    HBP: row.HBP || 0,
    SF: row.SF || 0,
    IBB: row.IBB || 0,
  };
  return map[sort] ?? pa;
}

// Pitching sort value extractor
function pitchingSortVal(
  row: {
    W?: number | null;
    L?: number | null;
    G?: number | null;
    GS?: number | null;
    CG?: number | null;
    SHO?: number | null;
    SV?: number | null;
    IPouts?: number | null;
    H?: number | null;
    R?: number | null;
    ER?: number | null;
    HR?: number | null;
    BB?: number | null;
    SO?: number | null;
  },
  sort: string,
  eraPlusVal?: number | null
): number {
  const ip = row.IPouts || 0;
  const eraVal = era(row.ER || 0, ip);
  const whipVal = whip(row.BB || 0, row.H || 0, ip);
  const so9 = perNine(row.SO || 0, ip);
  const soBb =
    row.BB && row.BB > 0 ? (row.SO || 0) / row.BB : 0;

  const map: Record<string, number> = {
    W: row.W || 0,
    L: row.L || 0,
    G: row.G || 0,
    GS: row.GS || 0,
    CG: row.CG || 0,
    SHO: row.SHO || 0,
    SV: row.SV || 0,
    IP: ip,
    H: row.H || 0,
    R: row.R || 0,
    ER: row.ER || 0,
    HR: row.HR || 0,
    BB: row.BB || 0,
    SO: row.SO || 0,
    WHIP: whipVal ?? 99,
    "SO/9": so9 ?? 0,
    "SO/BB": soBb,
    "H/9": perNine(row.H || 0, ip) ?? 99,
    "BB/9": perNine(row.BB || 0, ip) ?? 99,
    "ERA+": eraPlusVal ?? 0,
  };

  // For ERA and WHIP lower is better but we still sort desc by default and flip
  if (sort === "ERA") return -(eraVal ?? 99);
  if (sort === "WHIP") return -(whipVal ?? 99);
  if (sort === "H/9") return -(map["H/9"]);
  if (sort === "BB/9") return -(map["BB/9"]);

  return map[sort] ?? ip;
}

// Advanced sort value extractor
function advancedSortVal(
  row: {
    AB?: number | null;
    H?: number | null;
    doubles?: number | null;
    triples?: number | null;
    HR?: number | null;
    BB?: number | null;
    SO?: number | null;
    HBP?: number | null;
    SH?: number | null;
    SF?: number | null;
  },
  sort: string
): number {
  const pa = plateAppearances(
    row.AB || 0,
    row.BB || 0,
    row.HBP || 0,
    row.SH || 0,
    row.SF || 0
  );
  const babipVal = babip(
    row.H || 0,
    row.HR || 0,
    row.AB || 0,
    row.SO || 0,
    row.SF || 0
  );
  const isoVal = iso(
    row.doubles || 0,
    row.triples || 0,
    row.HR || 0,
    row.AB || 0
  );
  const hrPct = pa > 0 ? (row.HR || 0) / pa : 0;
  const kPctVal = kPct(row.SO || 0, pa);
  const bbPctVal = bbPct(row.BB || 0, pa);
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

  const map: Record<string, number> = {
    PA: pa,
    BABIP: babipVal ?? 0,
    ISO: isoVal ?? 0,
    "HR%": hrPct,
    "K%": kPctVal ?? 0,
    "BB%": bbPctVal ?? 0,
    OPS: opsVal ?? 0,
  };

  // K% lower is better for hitter, but user might want to sort either way. Just sort desc.
  return map[sort] ?? pa;
}

export default async function LeadersPage({
  params,
  searchParams,
}: Props) {
  const { year: yearStr, category } = await params;
  const sp = await searchParams;
  const year = parseInt(yearStr);

  // Fielding redirect
  if (category === "fielding") {
    redirect(`/baseball/seasons/${year}/fielding`);
  }

  if (!["batting", "pitching", "advanced"].includes(category)) notFound();

  const isBatting = category === "batting";
  const isPitching = category === "pitching";
  const isAdvanced = category === "advanced";

  const qualified = sp.qualified !== "false";
  const sortBy = sp.sort || (isBatting ? "PA" : isPitching ? "IP" : "PA");
  const role = sp.role;

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
            {isBatting
              ? "Batting"
              : isPitching
                ? "Pitching"
                : "Advanced"}{" "}
            Leaders
          </span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
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
              isPitching
                ? "border-accent bg-accent/5 text-accent"
                : "border-border hover:bg-surface-alt text-muted"
            }`}
          >
            Pitching
          </Link>
          <Link
            href={`/baseball/seasons/${year}/advanced`}
            className={`text-sm px-3 py-1.5 border rounded-md transition-colors ${
              isAdvanced
                ? "border-accent bg-accent/5 text-accent"
                : "border-border hover:bg-surface-alt text-muted"
            }`}
          >
            Advanced
          </Link>
        </div>

        {/* Qualified toggle */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href={`/baseball/seasons/${year}/${category}${qualified ? "?qualified=false" : ""}`}
            className="text-xs px-2.5 py-1 border border-border rounded hover:bg-surface-alt transition-colors"
          >
            {qualified ? "Show all players" : "Show qualified only"}
          </Link>
          {qualified && (
            <span className="text-xs text-muted">
              {isBatting || isAdvanced
                ? "Min 502 PA"
                : "Min 162 IP"}
            </span>
          )}

          {/* Starter/Reliever tabs for pitching */}
          {isPitching && (
            <>
              <Link
                href={`/baseball/seasons/${year}/pitching?qualified=${qualified}${!role ? "" : ""}`}
                className={`text-xs px-2.5 py-1 border rounded transition-colors ${
                  !role
                    ? "border-accent bg-accent/5 text-accent"
                    : "border-border hover:bg-surface-alt text-muted"
                }`}
              >
                All
              </Link>
              <Link
                href={`/baseball/seasons/${year}/pitching?qualified=${qualified}&role=starter`}
                className={`text-xs px-2.5 py-1 border rounded transition-colors ${
                  role === "starter"
                    ? "border-accent bg-accent/5 text-accent"
                    : "border-border hover:bg-surface-alt text-muted"
                }`}
              >
                Starters
              </Link>
              <Link
                href={`/baseball/seasons/${year}/pitching?qualified=${qualified}&role=reliever`}
                className={`text-xs px-2.5 py-1 border rounded transition-colors ${
                  role === "reliever"
                    ? "border-accent bg-accent/5 text-accent"
                    : "border-border hover:bg-surface-alt text-muted"
                }`}
              >
                Relievers
              </Link>
            </>
          )}
        </div>
      </div>

      {isBatting ? (
        <BattingTable year={year} qualified={qualified} sortBy={sortBy} />
      ) : isPitching ? (
        <PitchingTable
          year={year}
          qualified={qualified}
          sortBy={sortBy}
          role={role}
        />
      ) : (
        <AdvancedTable year={year} qualified={qualified} sortBy={sortBy} />
      )}
    </div>
  );
}

function sortLink(
  year: number,
  category: string,
  col: string,
  currentSort: string,
  qualified: boolean,
  role?: string
): string {
  const params = new URLSearchParams();
  if (!qualified) params.set("qualified", "false");
  params.set("sort", col);
  if (role) params.set("role", role);
  const qs = params.toString();
  return `/baseball/seasons/${year}/${category}${qs ? `?${qs}` : ""}`;
}

async function BattingTable({
  year,
  qualified,
  sortBy,
}: {
  year: number;
  qualified: boolean;
  sortBy: string;
}) {
  const [batters, warMap, leagueAvg] = await Promise.all([
    getBattingLeaders(year, qualified),
    getWARData(year),
    getLeagueAverages(year),
  ]);

  if (batters.length === 0) {
    return (
      <p className="text-muted text-sm">No batting data found for {year}.</p>
    );
  }

  // Fetch league averages per league for the year
  const lgIDs = [...new Set(batters.map((r) => r.lgID).filter(Boolean))] as string[];
  const leagueAvgByLg = new Map<string, { OBP: number | null; SLG: number | null }>();
  await Promise.all(
    lgIDs.map(async (lgID) => {
      const avg = await getLeagueAverages(year, lgID);
      leagueAvgByLg.set(lgID, { OBP: avg.OBP, SLG: avg.SLG });
    })
  );

  // Fetch park factors for all teams in this year
  const teamIDs = [...new Set(batters.map((r) => r.teamID).filter(Boolean))] as string[];
  const teamRows = await prisma.teams.findMany({
    where: { yearID: year, teamID: { in: teamIDs } },
    select: { teamID: true, BPF: true },
  });
  const bpfMap = new Map<string, number>();
  for (const t of teamRows) {
    bpfMap.set(t.teamID, t.BPF ?? 100);
  }

  // Pre-compute OPS+ for each batter
  const opsPlusMap = new Map<string, number | null>();
  for (const row of batters) {
    const lg = row.lgID ? leagueAvgByLg.get(row.lgID) : null;
    if (!lg || lg.OBP == null || lg.SLG == null) {
      opsPlusMap.set(`${row.playerID}-${row.stint}`, null);
      continue;
    }
    const playerOBP = onBasePct(row.H || 0, row.BB || 0, row.HBP || 0, row.AB || 0, row.SF || 0);
    const playerSLG = sluggingPct(row.H || 0, row.doubles || 0, row.triples || 0, row.HR || 0, row.AB || 0);
    if (playerOBP == null || playerSLG == null) {
      opsPlusMap.set(`${row.playerID}-${row.stint}`, null);
      continue;
    }
    const bpf = row.teamID ? (bpfMap.get(row.teamID) ?? 100) : 100;
    opsPlusMap.set(`${row.playerID}-${row.stint}`, opsPlus(playerOBP, playerSLG, lg.OBP, lg.SLG, bpf));
  }

  const sorted = sortRows(batters, (r) => battingSortVal(r, sortBy, opsPlusMap.get(`${r.playerID}-${r.stint}`)));

  const cols = [
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
    "OPS+",
    "TB",
    "GIDP",
    "HBP",
    "SF",
    "IBB",
    "WAR",
  ];

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="stat-scroll overflow-x-auto">
        <table className="stat-table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {cols.map((col) => (
                <th
                  key={col}
                  className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                    ${["#", "Player", "Team"].includes(col) ? "text-left" : "text-right"}
                    ${col === "Player" ? "sticky left-0 z-20 bg-surface" : ""}`}
                >
                  {["#", "Player", "Team"].includes(col) ? (
                    col
                  ) : (
                    <Link
                      href={sortLink(year, "batting", col, sortBy, qualified)}
                      className={`hover:text-foreground transition-colors ${sortBy === col ? "text-accent underline" : ""}`}
                    >
                      {col}
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {sorted.map((row, i) => {
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
              const war = warMap.get(row.playerID);
              const opsPlusVal = opsPlusMap.get(`${row.playerID}-${row.stint}`);

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
                      {fullName(
                        row.player.nameFirst,
                        row.player.nameLast,
                        row.player.nameGiven,
                        row.player.nameSuffix
                      )}
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
                    {fmtAvg(ops(obp, slg))}
                  </td>
                  <td className={`py-2 px-2.5 text-right font-mono text-xs${opsPlusVal != null && opsPlusVal > 120 ? " font-medium" : ""}`}>
                    {opsPlusVal != null ? opsPlusVal : "\u2014"}
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
                    {row.SF}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {row.IBB}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                    {war !== undefined ? war.toFixed(1) : "\u2014"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function PitchingTable({
  year,
  qualified,
  sortBy,
  role,
}: {
  year: number;
  qualified: boolean;
  sortBy: string;
  role?: string;
}) {
  const [pitchers, warMap, leagueAvg] = await Promise.all([
    getPitchingLeaders(year, qualified, role),
    getWARData(year),
    getLeagueAverages(year),
  ]);

  if (pitchers.length === 0) {
    return (
      <p className="text-muted text-sm">
        No pitching data found for {year}.
      </p>
    );
  }

  // Fetch league averages per league for the year
  const lgIDs = [...new Set(pitchers.map((r) => r.lgID).filter(Boolean))] as string[];
  const leagueAvgByLg = new Map<string, { ERA: number | null }>();
  await Promise.all(
    lgIDs.map(async (lgID) => {
      const avg = await getLeagueAverages(year, lgID);
      leagueAvgByLg.set(lgID, { ERA: avg.ERA });
    })
  );

  // Fetch park factors for all teams in this year
  const teamIDs = [...new Set(pitchers.map((r) => r.teamID).filter(Boolean))] as string[];
  const teamRows = await prisma.teams.findMany({
    where: { yearID: year, teamID: { in: teamIDs } },
    select: { teamID: true, PPF: true },
  });
  const ppfMap = new Map<string, number>();
  for (const t of teamRows) {
    ppfMap.set(t.teamID, t.PPF ?? 100);
  }

  // Pre-compute ERA+ for each pitcher
  const eraPlusMap = new Map<string, number | null>();
  for (const row of pitchers) {
    const lg = row.lgID ? leagueAvgByLg.get(row.lgID) : null;
    if (!lg || lg.ERA == null) {
      eraPlusMap.set(`${row.playerID}-${row.stint}`, null);
      continue;
    }
    const ip = row.IPouts || 0;
    const playerERA = era(row.ER || 0, ip);
    if (playerERA == null || playerERA === 0) {
      eraPlusMap.set(`${row.playerID}-${row.stint}`, null);
      continue;
    }
    const ppf = row.teamID ? (ppfMap.get(row.teamID) ?? 100) : 100;
    eraPlusMap.set(`${row.playerID}-${row.stint}`, eraPlus(playerERA, lg.ERA, ppf));
  }

  const sorted = sortRows(pitchers, (r) => pitchingSortVal(r, sortBy, eraPlusMap.get(`${r.playerID}-${r.stint}`)));

  const cols = [
    "#",
    "Player",
    "Team",
    "W",
    "L",
    "ERA",
    "ERA+",
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
    "WAR",
  ];

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="stat-scroll overflow-x-auto">
        <table className="stat-table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {cols.map((col) => (
                <th
                  key={col}
                  className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                    ${["#", "Player", "Team"].includes(col) ? "text-left" : "text-right"}
                    ${col === "Player" ? "sticky left-0 z-20 bg-surface" : ""}`}
                >
                  {["#", "Player", "Team"].includes(col) ? (
                    col
                  ) : (
                    <Link
                      href={sortLink(
                        year,
                        "pitching",
                        col,
                        sortBy,
                        qualified,
                        role
                      )}
                      className={`hover:text-foreground transition-colors ${sortBy === col ? "text-accent underline" : ""}`}
                    >
                      {col}
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {sorted.map((row, i) => {
              const ip = row.IPouts || 0;
              const eraVal = era(row.ER || 0, ip);
              const whipVal = whip(row.BB || 0, row.H || 0, ip);
              const h9 = perNine(row.H || 0, ip);
              const bb9 = perNine(row.BB || 0, ip);
              const so9 = perNine(row.SO || 0, ip);
              const soBb =
                row.BB && row.BB > 0
                  ? ((row.SO || 0) / row.BB).toFixed(2)
                  : "\u2014";
              const war = warMap.get(row.playerID);
              const eraPlusVal = eraPlusMap.get(`${row.playerID}-${row.stint}`);

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
                      {fullName(
                        row.player.nameFirst,
                        row.player.nameLast,
                        row.player.nameGiven,
                        row.player.nameSuffix
                      )}
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
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {row.W}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {row.L}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                    {fmtEra(eraVal)}
                  </td>
                  <td className={`py-2 px-2.5 text-right font-mono text-xs${eraPlusVal != null && eraPlusVal > 120 ? " font-medium" : ""}`}>
                    {eraPlusVal != null ? eraPlusVal : "\u2014"}
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
                    {h9 !== null ? h9.toFixed(1) : "\u2014"}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {bb9 !== null ? bb9.toFixed(1) : "\u2014"}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {so9 !== null ? so9.toFixed(1) : "\u2014"}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {soBb}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                    {war !== undefined ? war.toFixed(1) : "\u2014"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function AdvancedTable({
  year,
  qualified,
  sortBy,
}: {
  year: number;
  qualified: boolean;
  sortBy: string;
}) {
  const [batters, warMap] = await Promise.all([
    getAdvancedLeaders(year, qualified),
    getWARData(year),
  ]);

  if (batters.length === 0) {
    return (
      <p className="text-muted text-sm">
        No batting data found for {year}.
      </p>
    );
  }

  const sorted = sortRows(batters, (r) => advancedSortVal(r, sortBy));

  const cols = [
    "#",
    "Player",
    "Team",
    "PA",
    "BABIP",
    "ISO",
    "HR%",
    "K%",
    "BB%",
    "OPS",
    "WAR",
  ];

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="stat-scroll overflow-x-auto">
        <table className="stat-table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {cols.map((col) => (
                <th
                  key={col}
                  className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                    ${["#", "Player", "Team"].includes(col) ? "text-left" : "text-right"}
                    ${col === "Player" ? "sticky left-0 z-20 bg-surface" : ""}`}
                >
                  {["#", "Player", "Team"].includes(col) ? (
                    col
                  ) : (
                    <Link
                      href={sortLink(
                        year,
                        "advanced",
                        col,
                        sortBy,
                        qualified
                      )}
                      className={`hover:text-foreground transition-colors ${sortBy === col ? "text-accent underline" : ""}`}
                    >
                      {col}
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {sorted.map((row, i) => {
              const pa = plateAppearances(
                row.AB || 0,
                row.BB || 0,
                row.HBP || 0,
                row.SH || 0,
                row.SF || 0
              );
              const babipVal = babip(
                row.H || 0,
                row.HR || 0,
                row.AB || 0,
                row.SO || 0,
                row.SF || 0
              );
              const isoVal = iso(
                row.doubles || 0,
                row.triples || 0,
                row.HR || 0,
                row.AB || 0
              );
              const hrPct = pa > 0 ? (row.HR || 0) / pa : null;
              const kPctVal = kPct(row.SO || 0, pa);
              const bbPctVal = bbPct(row.BB || 0, pa);
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
              const war = warMap.get(row.playerID);

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
                      {fullName(
                        row.player.nameFirst,
                        row.player.nameLast,
                        row.player.nameGiven,
                        row.player.nameSuffix
                      )}
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
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {pa}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {fmtAvg(babipVal)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {fmtAvg(isoVal)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {fmtPct(hrPct)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {fmtPct(kPctVal)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                    {fmtPct(bbPctVal)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                    {fmtAvg(opsVal)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                    {war !== undefined ? war.toFixed(1) : "\u2014"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
