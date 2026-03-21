import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PlayerPortrait } from "@/components/ui/PlayerPortrait";
import { CountryFlag } from "@/components/ui/CountryFlag";
import {
  fmtAvg,
  fmtEra,
  fmtHeight,
  fmtInt,
  fmtIP,
  fmtSalary,
  fmtPct,
  fullName,
  ordinal,
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
  babip,
  iso,
  kPct,
  bbPct,
  fieldingPct,
} from "@/lib/stats";
import { StatCard } from "@/components/ui/StatCard";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const TH_LEFT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left";
const TH_RIGHT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-right";
const TD_LEFT = "py-2 px-2.5 text-left";
const TD_RIGHT = "py-2 px-2.5 text-right font-mono text-xs";
const TD_RIGHT_BOLD = "py-2 px-2.5 text-right font-mono text-xs font-medium";
const LINK_CLASSES =
  "text-link hover:text-link-hover hover:underline transition-colors";
const STICKY_TH =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left sticky left-0 z-20 bg-surface";
const STICKY_TD =
  "py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface";

function formatDate(year?: number | null, month?: number | null, day?: number | null): string | null {
  if (!year) return null;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const parts: string[] = [];
  if (month && months[month - 1]) parts.push(months[month - 1]);
  if (day) parts.push(`${day},`);
  parts.push(`${year}`);
  return parts.join(" ");
}

function computeAge(
  birthYear: number | null,
  birthMonth: number | null,
  birthDay: number | null,
  deathYear?: number | null,
  deathMonth?: number | null,
  deathDay?: number | null,
): number | null {
  if (!birthYear) return null;
  const refYear = deathYear || new Date().getFullYear();
  const refMonth = deathMonth || new Date().getMonth() + 1;
  const refDay = deathDay || new Date().getDate();
  let age = refYear - birthYear;
  if (birthMonth && (refMonth < birthMonth || (refMonth === birthMonth && birthDay && refDay < birthDay))) {
    age--;
  }
  return age;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  params: Promise<{ id: string }>;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const player = await prisma.people.findUnique({
    where: { playerID: id },
    select: { nameFirst: true, nameLast: true, nameGiven: true, nameSuffix: true },
  });
  if (!player) return { title: "Player Not Found" };
  return { title: fullName(player.nameFirst, player.nameLast, player.nameGiven, player.nameSuffix) };
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */
async function getPlayerData(id: string) {
  const player = await prisma.people.findUnique({
    where: { playerID: id },
  });

  if (!player) return null;

  const [
    batting,
    pitching,
    fielding,
    appearances,
    battingPost,
    pitchingPost,
    awards,
    awardsShare,
    allstar,
    salary,
    hallOfFame,
    playerWAR,
    collegePlaying,
  ] = await Promise.all([
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
    prisma.awardsSharePlayers.findMany({
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
      where: { playerID: id },
      orderBy: [{ yearid: "asc" }],
    }),
    prisma.playerWAR.findMany({
      where: { playerID: id },
      orderBy: [{ yearID: "asc" }],
    }),
    prisma.collegePlaying.findMany({
      where: { playerID: id },
      include: { school: true },
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
    awardsShare,
    allstar,
    salary,
    hallOfFame,
    playerWAR,
    collegePlaying,
  };
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const data = await getPlayerData(id);

  if (!data) notFound();

  const {
    player,
    batting,
    pitching,
    fielding,
    appearances,
    battingPost,
    pitchingPost,
    awards,
    awardsShare,
    allstar,
    salary,
    hallOfFame,
    playerWAR,
    collegePlaying,
  } = data;

  const isBatter = batting.length > 0;
  const isPitcher = pitching.length > 0 && pitching.some((p) => (p.GS || 0) > 0 || (p.G || 0) > 5);
  const isHOF = hallOfFame.some((h) => h.inducted === "Y");
  const allStarCount = allstar.length;

  // WAR lookup by yearID
  const warByYear: Record<number, { WAR: number | null; oWAR: number | null; dWAR: number | null }> = {};
  for (const w of playerWAR) {
    warByYear[w.yearID] = { WAR: w.WAR, oWAR: w.oWAR, dWAR: w.dWAR };
  }

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
        { G: 0, AB: 0, R: 0, H: 0, doubles: 0, triples: 0, HR: 0, RBI: 0, SB: 0, CS: 0, BB: 0, SO: 0, IBB: 0, HBP: 0, SH: 0, SF: 0, GIDP: 0 },
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
        { W: 0, L: 0, G: 0, GS: 0, CG: 0, SHO: 0, SV: 0, IPouts: 0, H: 0, ER: 0, HR: 0, BB: 0, SO: 0, R: 0, HBP: 0, BFP: 0 },
      )
    : null;

  // Career WAR total
  const careerWAR = playerWAR.reduce((sum, w) => sum + (w.WAR || 0), 0);

  // Determine primary position from fielding
  const positionCounts: Record<string, number> = {};
  for (const f of fielding) {
    if (f.POS && f.POS !== "DH") {
      positionCounts[f.POS] = (positionCounts[f.POS] || 0) + (f.G || 0);
    }
  }
  const primaryPosition =
    Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "DH";

  // Unique batting years
  const battingYears = [...new Set(batting.map((b) => b.yearID))];
  // Unique pitching years
  const pitchingYears = [...new Set(pitching.map((p) => p.yearID))];

  // Experience: distinct years from batting union pitching
  const experienceYears = new Set([...batting.map((b) => b.yearID), ...pitching.map((p) => p.yearID)]);
  const experience = experienceYears.size;

  // College
  const colleges = collegePlaying.length > 0
    ? [...new Map(collegePlaying.map((c) => [c.schoolID, c.school.name_full])).values()]
    : [];

  // Age
  const age = computeAge(
    player.birthYear,
    player.birthMonth,
    player.birthDay,
    player.deathYear,
    player.deathMonth,
    player.deathDay,
  );

  // Awards share data for MVP / Cy Young / ROY voting detail
  const votingAwards = ["MVP", "Cy Young", "Rookie of the Year"];
  const votingDetail = awardsShare
    .filter((a) => votingAwards.some((v) => a.awardID.includes(v) || a.awardID === v))
    .sort((a, b) => a.yearID - b.yearID);

  // Badge awards: everything from awardsPlayers that isn't shown via votingDetail
  const badgeAwards = awards;

  // Postseason pitching career totals
  const careerPitchingPost = pitchingPost.length > 0
    ? pitchingPost.reduce(
        (acc, row) => ({
          W: acc.W + (row.W || 0),
          L: acc.L + (row.L || 0),
          G: acc.G + (row.G || 0),
          GS: acc.GS + (row.GS || 0),
          SV: acc.SV + (row.SV || 0),
          IPouts: acc.IPouts + (row.IPouts || 0),
          H: acc.H + (row.H || 0),
          ER: acc.ER + (row.ER || 0),
          HR: acc.HR + (row.HR || 0),
          BB: acc.BB + (row.BB || 0),
          SO: acc.SO + (row.SO || 0),
        }),
        { W: 0, L: 0, G: 0, GS: 0, SV: 0, IPouts: 0, H: 0, ER: 0, HR: 0, BB: 0, SO: 0 },
      )
    : null;

  // Determine if player is retired (finalGame set and not in recent years)
  const currentYear = new Date().getFullYear();
  const lastActiveYear = Math.max(
    ...batting.map((b) => b.yearID),
    ...pitching.map((p) => p.yearID),
    0
  );
  const isRetired = player.finalGame != null && lastActiveYear < currentYear - 1;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* =================================================================== */}
      {/* 1. Enhanced Player Header                                           */}
      {/* =================================================================== */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-8">
          {/* Portrait */}
          <PlayerPortrait
            mlbamID={player.mlbamID}
            playerID={player.playerID}
            name={fullName(player.nameFirst, player.nameLast, player.nameGiven, player.nameSuffix)}
            initials={(player.nameFirst?.[0] || "") + (player.nameLast?.[0] || "")}
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">
                {primaryPosition}
              </span>
              {player.uniformNumber && (
                <div className="inline-flex items-center justify-center w-8 h-8 border border-border rounded bg-surface">
                  <span className="font-mono font-bold text-sm">{player.uniformNumber}</span>
                </div>
              )}
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

            {player.nickName && (
              <p className="text-sm text-muted mt-1">&ldquo;{player.nickName}&rdquo;</p>
            )}

            {player.nameGiven &&
              player.nameGiven !== `${player.nameFirst} ${player.nameLast}` && (
                <p className="text-sm text-muted mt-1">{player.nameGiven}</p>
              )}

            {/* Bio details */}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {player.bats && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Bats</span>{" "}
                  {player.bats === "R" ? "Right" : player.bats === "L" ? "Left" : "Both"}
                </span>
              )}
              {player.throws && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Throws</span>{" "}
                  {player.throws === "R" ? "Right" : "Left"}
                </span>
              )}
              {player.height && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Height</span>{" "}
                  {fmtHeight(player.height)}
                </span>
              )}
              {player.weight && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Weight</span>{" "}
                  {player.weight} lb
                </span>
              )}
              {age !== null && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">
                    {player.deathYear ? "Died at" : "Age"}
                  </span>{" "}
                  {age}
                </span>
              )}
              {experience > 0 && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Experience</span>{" "}
                  {experience} {experience === 1 ? "year" : "years"}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {player.birthYear && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Born</span>{" "}
                  {formatDate(player.birthYear, player.birthMonth, player.birthDay)}
                  {player.birthCity && `, ${player.birthCity}`}
                  {player.birthState && `, ${player.birthState}`}
                  {player.birthCountry && (
                    <> <CountryFlag country={player.birthCountry} /></>
                  )}
                </span>
              )}
              {player.deathYear && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Died</span>{" "}
                  {formatDate(player.deathYear, player.deathMonth, player.deathDay)}
                  {player.deathCity && `, ${player.deathCity}`}
                  {player.deathState && `, ${player.deathState}`}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {player.debut && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Debut</span>{" "}
                  {player.debut}
                </span>
              )}
              {isRetired && player.finalGame && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">Final Game</span>{" "}
                  {player.finalGame}
                </span>
              )}
              {colleges.length > 0 && (
                <span>
                  <span className="text-xs uppercase tracking-wider text-muted-light">College</span>{" "}
                  {colleges.join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 2. Career stat highlight cards                                    */}
        {/* ---------------------------------------------------------------- */}
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
                    onBasePct(careerBatting.H, careerBatting.BB, careerBatting.HBP, careerBatting.AB, careerBatting.SF),
                    sluggingPct(careerBatting.H, careerBatting.doubles, careerBatting.triples, careerBatting.HR, careerBatting.AB),
                  ),
                )}
              />
              <StatCard label="SB" value={fmtInt(careerBatting.SB)} />
            </>
          )}
          {careerPitching && (
            <>
              <StatCard label="ERA" value={fmtEra(era(careerPitching.ER, careerPitching.IPouts))} />
              <StatCard label="W-L" value={`${careerPitching.W}-${careerPitching.L}`} />
              <StatCard label="SO" value={fmtInt(careerPitching.SO)} />
              <StatCard label="IP" value={fmtIP(careerPitching.IPouts)} />
              <StatCard label="WHIP" value={fmtEra(whip(careerPitching.BB, careerPitching.H, careerPitching.IPouts))} />
            </>
          )}
          {playerWAR.length > 0 && (
            <StatCard label="WAR" value={careerWAR.toFixed(1)} />
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. Awards Section (enhanced)                                        */}
      {/* =================================================================== */}
      {(awards.length > 0 || votingDetail.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">Awards</h2>

          {/* Voting detail for MVP / Cy Young / ROY */}
          {votingDetail.length > 0 && (
            <div className="mb-4 space-y-1">
              {votingDetail.map((a, i) => {
                // Determine rank: sort all awardsShare entries for this award+year+league by pointsWon desc
                // We only have this player's data, so show points info
                const pctWon = a.pointsMax && a.pointsMax > 0
                  ? ((a.pointsWon || 0) / a.pointsMax * 100).toFixed(1)
                  : null;
                return (
                  <p key={i} className="text-sm">
                    <span className="font-medium">{a.yearID}</span>{" "}
                    <span className="text-muted">{a.lgID}</span>{" "}
                    {a.awardID}{" "}
                    <span className="text-muted">
                      ({a.pointsWon ?? 0}/{a.pointsMax ?? 0} pts
                      {pctWon && `, ${pctWon}%`}
                      {a.votesFirst != null && a.votesFirst > 0 && `, ${a.votesFirst} 1st`})
                    </span>
                  </p>
                );
              })}
            </div>
          )}

          {/* Badge awards */}
          {badgeAwards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badgeAwards.map((a, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 border border-border rounded-md bg-surface"
                >
                  {a.awardID} ({a.yearID}
                  {a.lgID ? `, ${a.lgID}` : ""})
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* 4. Standard Batting Table                                           */}
      {/* =================================================================== */}
      {isBatter && careerBatting && (() => {
        const careerPA = plateAppearances(careerBatting.AB, careerBatting.BB, careerBatting.HBP, careerBatting.SH, careerBatting.SF);
        const scaleFactor = careerBatting.G > 0 ? 162 / careerBatting.G : 0;
        const avg162 = (n: number) => Math.round(n * scaleFactor);

        return (
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
                        "Year", "Team", "Lg", "G", "PA", "AB", "R", "H",
                        "2B", "3B", "HR", "RBI", "SB", "CS", "BB", "SO",
                        "BA", "OBP", "SLG", "OPS", "TB", "GIDP", "HBP",
                        "SH", "SF", "IBB", "WAR",
                      ].map((col) => (
                        <th
                          key={col}
                          className={
                            col === "Year"
                              ? STICKY_TH
                              : ["Team", "Lg"].includes(col)
                                ? TH_LEFT
                                : TH_RIGHT
                          }
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {batting.map((row) => {
                      const pa = plateAppearances(row.AB || 0, row.BB || 0, row.HBP || 0, row.SH || 0, row.SF || 0);
                      const avg = battingAvg(row.H || 0, row.AB || 0);
                      const obp = onBasePct(row.H || 0, row.BB || 0, row.HBP || 0, row.AB || 0, row.SF || 0);
                      const slg = sluggingPct(row.H || 0, row.doubles || 0, row.triples || 0, row.HR || 0, row.AB || 0);
                      const opsVal = ops(obp, slg);
                      const tb = totalBases(row.H || 0, row.doubles || 0, row.triples || 0, row.HR || 0);
                      const war = warByYear[row.yearID];

                      return (
                        <tr key={`${row.yearID}-${row.stint}`}>
                          <td className={STICKY_TD}>
                            <Link href={`/baseball/seasons/${row.yearID}`} className={LINK_CLASSES}>
                              {row.yearID}
                            </Link>
                          </td>
                          <td className={TD_LEFT}>
                            <Link href={`/baseball/teams/${row.teamID}/${row.yearID}`} className={LINK_CLASSES}>
                              {row.teamID}
                            </Link>
                          </td>
                          <td className={`${TD_LEFT} text-muted`}>{row.lgID}</td>
                          <td className={TD_RIGHT}>{row.G}</td>
                          <td className={TD_RIGHT}>{pa}</td>
                          <td className={TD_RIGHT}>{row.AB}</td>
                          <td className={TD_RIGHT}>{row.R}</td>
                          <td className={TD_RIGHT_BOLD}>{row.H}</td>
                          <td className={TD_RIGHT}>{row.doubles}</td>
                          <td className={TD_RIGHT}>{row.triples}</td>
                          <td className={TD_RIGHT_BOLD}>{row.HR}</td>
                          <td className={TD_RIGHT}>{row.RBI}</td>
                          <td className={TD_RIGHT}>{row.SB}</td>
                          <td className={TD_RIGHT}>{row.CS}</td>
                          <td className={TD_RIGHT}>{row.BB}</td>
                          <td className={TD_RIGHT}>{row.SO}</td>
                          <td className={TD_RIGHT_BOLD}>{fmtAvg(avg)}</td>
                          <td className={TD_RIGHT}>{fmtAvg(obp)}</td>
                          <td className={TD_RIGHT}>{fmtAvg(slg)}</td>
                          <td className={TD_RIGHT_BOLD}>{fmtAvg(opsVal)}</td>
                          <td className={TD_RIGHT}>{tb}</td>
                          <td className={TD_RIGHT}>{row.GIDP}</td>
                          <td className={TD_RIGHT}>{row.HBP}</td>
                          <td className={TD_RIGHT}>{row.SH}</td>
                          <td className={TD_RIGHT}>{row.SF}</td>
                          <td className={TD_RIGHT}>{row.IBB}</td>
                          <td className={TD_RIGHT}>{war?.WAR != null ? war.WAR.toFixed(1) : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-border font-medium">
                    {/* Career totals row */}
                    <tr>
                      <td className={STICKY_TD}>{battingYears.length} Yrs</td>
                      <td className={TD_LEFT} colSpan={2}></td>
                      <td className={TD_RIGHT}>{careerBatting.G}</td>
                      <td className={TD_RIGHT}>{careerPA}</td>
                      <td className={TD_RIGHT}>{careerBatting.AB}</td>
                      <td className={TD_RIGHT}>{careerBatting.R}</td>
                      <td className={TD_RIGHT}>{careerBatting.H}</td>
                      <td className={TD_RIGHT}>{careerBatting.doubles}</td>
                      <td className={TD_RIGHT}>{careerBatting.triples}</td>
                      <td className={TD_RIGHT}>{careerBatting.HR}</td>
                      <td className={TD_RIGHT}>{careerBatting.RBI}</td>
                      <td className={TD_RIGHT}>{careerBatting.SB}</td>
                      <td className={TD_RIGHT}>{careerBatting.CS}</td>
                      <td className={TD_RIGHT}>{careerBatting.BB}</td>
                      <td className={TD_RIGHT}>{careerBatting.SO}</td>
                      <td className={TD_RIGHT}>{fmtAvg(battingAvg(careerBatting.H, careerBatting.AB))}</td>
                      <td className={TD_RIGHT}>{fmtAvg(onBasePct(careerBatting.H, careerBatting.BB, careerBatting.HBP, careerBatting.AB, careerBatting.SF))}</td>
                      <td className={TD_RIGHT}>{fmtAvg(sluggingPct(careerBatting.H, careerBatting.doubles, careerBatting.triples, careerBatting.HR, careerBatting.AB))}</td>
                      <td className={TD_RIGHT}>{fmtAvg(ops(onBasePct(careerBatting.H, careerBatting.BB, careerBatting.HBP, careerBatting.AB, careerBatting.SF), sluggingPct(careerBatting.H, careerBatting.doubles, careerBatting.triples, careerBatting.HR, careerBatting.AB)))}</td>
                      <td className={TD_RIGHT}>{totalBases(careerBatting.H, careerBatting.doubles, careerBatting.triples, careerBatting.HR)}</td>
                      <td className={TD_RIGHT}>{careerBatting.GIDP}</td>
                      <td className={TD_RIGHT}>{careerBatting.HBP}</td>
                      <td className={TD_RIGHT}>{careerBatting.SH}</td>
                      <td className={TD_RIGHT}>{careerBatting.SF}</td>
                      <td className={TD_RIGHT}>{careerBatting.IBB}</td>
                      <td className={TD_RIGHT}>{careerWAR.toFixed(1)}</td>
                    </tr>
                    {/* 162-game average row */}
                    {careerBatting.G > 0 && (
                      <tr className="text-muted">
                        <td className={STICKY_TD}>162 Avg</td>
                        <td className={TD_LEFT} colSpan={2}></td>
                        <td className={TD_RIGHT}>162</td>
                        <td className={TD_RIGHT}>{avg162(careerPA)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.AB)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.R)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.H)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.doubles)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.triples)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.HR)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.RBI)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.SB)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.CS)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.BB)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.SO)}</td>
                        <td className={TD_RIGHT}>{fmtAvg(battingAvg(careerBatting.H, careerBatting.AB))}</td>
                        <td className={TD_RIGHT}>{fmtAvg(onBasePct(careerBatting.H, careerBatting.BB, careerBatting.HBP, careerBatting.AB, careerBatting.SF))}</td>
                        <td className={TD_RIGHT}>{fmtAvg(sluggingPct(careerBatting.H, careerBatting.doubles, careerBatting.triples, careerBatting.HR, careerBatting.AB))}</td>
                        <td className={TD_RIGHT}>{fmtAvg(ops(onBasePct(careerBatting.H, careerBatting.BB, careerBatting.HBP, careerBatting.AB, careerBatting.SF), sluggingPct(careerBatting.H, careerBatting.doubles, careerBatting.triples, careerBatting.HR, careerBatting.AB)))}</td>
                        <td className={TD_RIGHT}>{avg162(totalBases(careerBatting.H, careerBatting.doubles, careerBatting.triples, careerBatting.HR))}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.GIDP)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.HBP)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.SH)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.SF)}</td>
                        <td className={TD_RIGHT}>{avg162(careerBatting.IBB)}</td>
                        <td className={TD_RIGHT}></td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        );
      })()}

      {/* =================================================================== */}
      {/* 5. Advanced Batting Table                                           */}
      {/* =================================================================== */}
      {isBatter && careerBatting && (() => {
        const careerPA = plateAppearances(careerBatting.AB, careerBatting.BB, careerBatting.HBP, careerBatting.SH, careerBatting.SF);
        return (
          <section className="mb-10">
            <h2 className="text-lg font-semibold tracking-tight mb-4">
              Advanced Batting
            </h2>
            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              <div className="stat-scroll overflow-x-auto">
                <table className="stat-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Year", "Team", "PA", "BABIP", "ISO", "HR%", "K%", "BB%", "OPS"].map(
                        (col) => (
                          <th
                            key={col}
                            className={
                              col === "Year"
                                ? STICKY_TH
                                : col === "Team"
                                  ? TH_LEFT
                                  : TH_RIGHT
                            }
                          >
                            {col}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {batting.map((row) => {
                      const pa = plateAppearances(row.AB || 0, row.BB || 0, row.HBP || 0, row.SH || 0, row.SF || 0);
                      const babipVal = babip(row.H || 0, row.HR || 0, row.AB || 0, row.SO || 0, row.SF || 0);
                      const isoVal = iso(row.doubles || 0, row.triples || 0, row.HR || 0, row.AB || 0);
                      const hrPct = pa > 0 ? (row.HR || 0) / pa : null;
                      const kPctVal = kPct(row.SO || 0, pa);
                      const bbPctVal = bbPct(row.BB || 0, pa);
                      const obp = onBasePct(row.H || 0, row.BB || 0, row.HBP || 0, row.AB || 0, row.SF || 0);
                      const slg = sluggingPct(row.H || 0, row.doubles || 0, row.triples || 0, row.HR || 0, row.AB || 0);
                      const opsVal = ops(obp, slg);

                      return (
                        <tr key={`adv-${row.yearID}-${row.stint}`}>
                          <td className={STICKY_TD}>
                            <Link href={`/baseball/seasons/${row.yearID}`} className={LINK_CLASSES}>
                              {row.yearID}
                            </Link>
                          </td>
                          <td className={TD_LEFT}>
                            <Link href={`/baseball/teams/${row.teamID}/${row.yearID}`} className={LINK_CLASSES}>
                              {row.teamID}
                            </Link>
                          </td>
                          <td className={TD_RIGHT}>{pa}</td>
                          <td className={TD_RIGHT}>{fmtAvg(babipVal)}</td>
                          <td className={TD_RIGHT}>{fmtAvg(isoVal)}</td>
                          <td className={TD_RIGHT}>{fmtPct(hrPct)}</td>
                          <td className={TD_RIGHT}>{fmtPct(kPctVal)}</td>
                          <td className={TD_RIGHT}>{fmtPct(bbPctVal)}</td>
                          <td className={TD_RIGHT_BOLD}>{fmtAvg(opsVal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-border font-medium">
                    <tr>
                      <td className={STICKY_TD}>Career</td>
                      <td className={TD_LEFT}></td>
                      <td className={TD_RIGHT}>{careerPA}</td>
                      <td className={TD_RIGHT}>{fmtAvg(babip(careerBatting.H, careerBatting.HR, careerBatting.AB, careerBatting.SO, careerBatting.SF))}</td>
                      <td className={TD_RIGHT}>{fmtAvg(iso(careerBatting.doubles, careerBatting.triples, careerBatting.HR, careerBatting.AB))}</td>
                      <td className={TD_RIGHT}>{fmtPct(careerPA > 0 ? careerBatting.HR / careerPA : null)}</td>
                      <td className={TD_RIGHT}>{fmtPct(kPct(careerBatting.SO, careerPA))}</td>
                      <td className={TD_RIGHT}>{fmtPct(bbPct(careerBatting.BB, careerPA))}</td>
                      <td className={TD_RIGHT}>{fmtAvg(ops(onBasePct(careerBatting.H, careerBatting.BB, careerBatting.HBP, careerBatting.AB, careerBatting.SF), sluggingPct(careerBatting.H, careerBatting.doubles, careerBatting.triples, careerBatting.HR, careerBatting.AB)))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        );
      })()}

      {/* =================================================================== */}
      {/* 6. Standard Pitching Table                                          */}
      {/* =================================================================== */}
      {isPitcher && careerPitching && (() => {
        const scaleFactor = careerPitching.G > 0 ? 162 / careerPitching.G : 0;
        const avg162 = (n: number) => Math.round(n * scaleFactor);

        return (
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
                        "Year", "Team", "Lg", "W", "L", "ERA", "G", "GS",
                        "CG", "SHO", "SV", "IP", "H", "R", "ER", "HR",
                        "BB", "SO", "WHIP", "H/9", "HR/9", "BB/9", "SO/9", "SO/BB", "WAR",
                      ].map((col) => (
                        <th
                          key={col}
                          className={
                            col === "Year"
                              ? STICKY_TH
                              : ["Team", "Lg"].includes(col)
                                ? TH_LEFT
                                : TH_RIGHT
                          }
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
                      const soBb = row.BB && row.BB > 0 ? ((row.SO || 0) / row.BB).toFixed(2) : "\u2014";
                      const war = warByYear[row.yearID];

                      return (
                        <tr key={`${row.yearID}-${row.stint}`}>
                          <td className={STICKY_TD}>
                            <Link href={`/baseball/seasons/${row.yearID}`} className={LINK_CLASSES}>
                              {row.yearID}
                            </Link>
                          </td>
                          <td className={TD_LEFT}>
                            <Link href={`/baseball/teams/${row.teamID}/${row.yearID}`} className={LINK_CLASSES}>
                              {row.teamID}
                            </Link>
                          </td>
                          <td className={`${TD_LEFT} text-muted`}>{row.lgID}</td>
                          <td className={TD_RIGHT}>{row.W}</td>
                          <td className={TD_RIGHT}>{row.L}</td>
                          <td className={TD_RIGHT_BOLD}>{fmtEra(eraVal)}</td>
                          <td className={TD_RIGHT}>{row.G}</td>
                          <td className={TD_RIGHT}>{row.GS}</td>
                          <td className={TD_RIGHT}>{row.CG}</td>
                          <td className={TD_RIGHT}>{row.SHO}</td>
                          <td className={TD_RIGHT}>{row.SV}</td>
                          <td className={TD_RIGHT}>{inningsPitchedDisplay(ip)}</td>
                          <td className={TD_RIGHT}>{row.H}</td>
                          <td className={TD_RIGHT}>{row.R}</td>
                          <td className={TD_RIGHT}>{row.ER}</td>
                          <td className={TD_RIGHT}>{row.HR}</td>
                          <td className={TD_RIGHT}>{row.BB}</td>
                          <td className={TD_RIGHT_BOLD}>{row.SO}</td>
                          <td className={TD_RIGHT}>{fmtEra(whipVal)}</td>
                          <td className={TD_RIGHT}>{h9 !== null ? h9.toFixed(1) : "\u2014"}</td>
                          <td className={TD_RIGHT}>{hr9 !== null ? hr9.toFixed(1) : "\u2014"}</td>
                          <td className={TD_RIGHT}>{bb9 !== null ? bb9.toFixed(1) : "\u2014"}</td>
                          <td className={TD_RIGHT}>{so9 !== null ? so9.toFixed(1) : "\u2014"}</td>
                          <td className={TD_RIGHT}>{soBb}</td>
                          <td className={TD_RIGHT}>{war?.WAR != null ? war.WAR.toFixed(1) : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-border font-medium">
                    {/* Career totals */}
                    <tr>
                      <td className={STICKY_TD}>Career</td>
                      <td className={TD_LEFT} colSpan={2}></td>
                      <td className={TD_RIGHT}>{careerPitching.W}</td>
                      <td className={TD_RIGHT}>{careerPitching.L}</td>
                      <td className={TD_RIGHT}>{fmtEra(era(careerPitching.ER, careerPitching.IPouts))}</td>
                      <td className={TD_RIGHT}>{careerPitching.G}</td>
                      <td className={TD_RIGHT}>{careerPitching.GS}</td>
                      <td className={TD_RIGHT}>{careerPitching.CG}</td>
                      <td className={TD_RIGHT}>{careerPitching.SHO}</td>
                      <td className={TD_RIGHT}>{careerPitching.SV}</td>
                      <td className={TD_RIGHT}>{inningsPitchedDisplay(careerPitching.IPouts)}</td>
                      <td className={TD_RIGHT}>{careerPitching.H}</td>
                      <td className={TD_RIGHT}>{careerPitching.R}</td>
                      <td className={TD_RIGHT}>{careerPitching.ER}</td>
                      <td className={TD_RIGHT}>{careerPitching.HR}</td>
                      <td className={TD_RIGHT}>{careerPitching.BB}</td>
                      <td className={TD_RIGHT}>{careerPitching.SO}</td>
                      <td className={TD_RIGHT}>{fmtEra(whip(careerPitching.BB, careerPitching.H, careerPitching.IPouts))}</td>
                      <td className={TD_RIGHT} colSpan={4}></td>
                      <td className={TD_RIGHT}>
                        {careerPitching.BB > 0 ? (careerPitching.SO / careerPitching.BB).toFixed(2) : "\u2014"}
                      </td>
                      <td className={TD_RIGHT}>{careerWAR.toFixed(1)}</td>
                    </tr>
                    {/* 162-game average */}
                    {careerPitching.G > 0 && (
                      <tr className="text-muted">
                        <td className={STICKY_TD}>162 Avg</td>
                        <td className={TD_LEFT} colSpan={2}></td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.W)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.L)}</td>
                        <td className={TD_RIGHT}>{fmtEra(era(careerPitching.ER, careerPitching.IPouts))}</td>
                        <td className={TD_RIGHT}>162</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.GS)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.CG)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.SHO)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.SV)}</td>
                        <td className={TD_RIGHT}>{(careerPitching.IPouts / 3 * scaleFactor).toFixed(1)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.H)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.R)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.ER)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.HR)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.BB)}</td>
                        <td className={TD_RIGHT}>{avg162(careerPitching.SO)}</td>
                        <td className={TD_RIGHT}>{fmtEra(whip(careerPitching.BB, careerPitching.H, careerPitching.IPouts))}</td>
                        <td className={TD_RIGHT} colSpan={6}></td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        );
      })()}

      {/* =================================================================== */}
      {/* 7. Fielding Stats Table                                             */}
      {/* =================================================================== */}
      {fielding.length > 0 && (() => {
        // Career totals grouped by position
        const careerByPos: Record<string, { G: number; GS: number; InnOuts: number; PO: number; A: number; E: number; DP: number }> = {};
        for (const f of fielding) {
          if (!careerByPos[f.POS]) {
            careerByPos[f.POS] = { G: 0, GS: 0, InnOuts: 0, PO: 0, A: 0, E: 0, DP: 0 };
          }
          const p = careerByPos[f.POS];
          p.G += f.G || 0;
          p.GS += f.GS || 0;
          p.InnOuts += f.InnOuts || 0;
          p.PO += f.PO || 0;
          p.A += f.A || 0;
          p.E += f.E || 0;
          p.DP += f.DP || 0;
        }

        return (
          <section className="mb-10">
            <h2 className="text-lg font-semibold tracking-tight mb-4">
              Fielding Stats
            </h2>
            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              <div className="stat-scroll overflow-x-auto">
                <table className="stat-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Year", "Team", "POS", "G", "GS", "Inn", "PO", "A", "E", "DP", "Fld%"].map(
                        (col) => (
                          <th
                            key={col}
                            className={
                              col === "Year"
                                ? STICKY_TH
                                : ["Team", "POS"].includes(col)
                                  ? TH_LEFT
                                  : TH_RIGHT
                            }
                          >
                            {col}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {fielding.map((row, i) => {
                      const inn = row.InnOuts != null ? (row.InnOuts / 3).toFixed(1) : "\u2014";
                      const fPct = fieldingPct(row.PO || 0, row.A || 0, row.E || 0);
                      return (
                        <tr key={i}>
                          <td className={STICKY_TD}>
                            <Link href={`/baseball/seasons/${row.yearID}`} className={LINK_CLASSES}>
                              {row.yearID}
                            </Link>
                          </td>
                          <td className={TD_LEFT}>
                            <Link href={`/baseball/teams/${row.teamID}/${row.yearID}`} className={LINK_CLASSES}>
                              {row.teamID}
                            </Link>
                          </td>
                          <td className={TD_LEFT}>{row.POS}</td>
                          <td className={TD_RIGHT}>{row.G}</td>
                          <td className={TD_RIGHT}>{row.GS}</td>
                          <td className={TD_RIGHT}>{inn}</td>
                          <td className={TD_RIGHT}>{row.PO}</td>
                          <td className={TD_RIGHT}>{row.A}</td>
                          <td className={TD_RIGHT}>{row.E}</td>
                          <td className={TD_RIGHT}>{row.DP}</td>
                          <td className={TD_RIGHT}>{fPct !== null ? fPct.toFixed(3) : "\u2014"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-border font-medium">
                    {Object.entries(careerByPos)
                      .sort((a, b) => b[1].G - a[1].G)
                      .map(([pos, totals]) => {
                        const fPct = fieldingPct(totals.PO, totals.A, totals.E);
                        return (
                          <tr key={pos}>
                            <td className={STICKY_TD}>Career</td>
                            <td className={TD_LEFT}></td>
                            <td className={TD_LEFT}>{pos}</td>
                            <td className={TD_RIGHT}>{totals.G}</td>
                            <td className={TD_RIGHT}>{totals.GS}</td>
                            <td className={TD_RIGHT}>{(totals.InnOuts / 3).toFixed(1)}</td>
                            <td className={TD_RIGHT}>{totals.PO}</td>
                            <td className={TD_RIGHT}>{totals.A}</td>
                            <td className={TD_RIGHT}>{totals.E}</td>
                            <td className={TD_RIGHT}>{totals.DP}</td>
                            <td className={TD_RIGHT}>{fPct !== null ? fPct.toFixed(3) : "\u2014"}</td>
                          </tr>
                        );
                      })}
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        );
      })()}

      {/* =================================================================== */}
      {/* 8. Appearances by Position                                          */}
      {/* =================================================================== */}
      {appearances.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Appearances by Position
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Year", "Team", "G", "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH"].map(
                      (col) => (
                        <th
                          key={col}
                          className={
                            col === "Year"
                              ? STICKY_TH
                              : col === "Team"
                                ? TH_LEFT
                                : TH_RIGHT
                          }
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {appearances.map((row, i) => (
                    <tr key={i}>
                      <td className={STICKY_TD}>
                        <Link href={`/baseball/seasons/${row.yearID}`} className={LINK_CLASSES}>
                          {row.yearID}
                        </Link>
                      </td>
                      <td className={TD_LEFT}>
                        <Link href={`/baseball/teams/${row.teamID}/${row.yearID}`} className={LINK_CLASSES}>
                          {row.teamID}
                        </Link>
                      </td>
                      <td className={TD_RIGHT}>{row.G_all || 0}</td>
                      <td className={TD_RIGHT}>{row.G_p || ""}</td>
                      <td className={TD_RIGHT}>{row.G_c || ""}</td>
                      <td className={TD_RIGHT}>{row.G_1b || ""}</td>
                      <td className={TD_RIGHT}>{row.G_2b || ""}</td>
                      <td className={TD_RIGHT}>{row.G_3b || ""}</td>
                      <td className={TD_RIGHT}>{row.G_ss || ""}</td>
                      <td className={TD_RIGHT}>{row.G_lf || ""}</td>
                      <td className={TD_RIGHT}>{row.G_cf || ""}</td>
                      <td className={TD_RIGHT}>{row.G_rf || ""}</td>
                      <td className={TD_RIGHT}>{row.G_of || ""}</td>
                      <td className={TD_RIGHT}>{row.G_dh || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* 9. Postseason Batting                                               */}
      {/* =================================================================== */}
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
                          className={
                            ["Year", "Round", "Team"].includes(col) ? TH_LEFT : TH_RIGHT
                          }
                        >
                          {col}
                        </th>
                      ),
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
                        <td className={`${TD_LEFT} font-medium`}>{row.yearID}</td>
                        <td className={`${TD_LEFT} text-muted`}>{row.round}</td>
                        <td className={TD_LEFT}>{row.teamID}</td>
                        <td className={TD_RIGHT}>{row.G}</td>
                        <td className={TD_RIGHT}>{row.AB}</td>
                        <td className={TD_RIGHT}>{row.R}</td>
                        <td className={TD_RIGHT}>{row.H}</td>
                        <td className={TD_RIGHT}>{row.doubles}</td>
                        <td className={TD_RIGHT}>{row.triples}</td>
                        <td className={TD_RIGHT}>{row.HR}</td>
                        <td className={TD_RIGHT}>{row.RBI}</td>
                        <td className={TD_RIGHT}>{row.BB}</td>
                        <td className={TD_RIGHT}>{row.SO}</td>
                        <td className={TD_RIGHT}>{fmtAvg(avg)}</td>
                        <td className={TD_RIGHT}>{fmtAvg(obpVal)}</td>
                        <td className={TD_RIGHT}>{fmtAvg(slgVal)}</td>
                        <td className={TD_RIGHT}>{fmtAvg(ops(obpVal, slgVal))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* 10. Postseason Pitching                                             */}
      {/* =================================================================== */}
      {pitchingPost.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Postseason Pitching
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Year", "Round", "Team", "W", "L", "ERA", "G", "GS", "SV", "IP", "H", "ER", "HR", "BB", "SO", "WHIP"].map(
                      (col) => (
                        <th
                          key={col}
                          className={
                            ["Year", "Round", "Team"].includes(col) ? TH_LEFT : TH_RIGHT
                          }
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {pitchingPost.map((row, i) => {
                    const ip = row.IPouts || 0;
                    const eraVal = era(row.ER || 0, ip);
                    const whipVal = whip(row.BB || 0, row.H || 0, ip);
                    return (
                      <tr key={i}>
                        <td className={`${TD_LEFT} font-medium`}>{row.yearID}</td>
                        <td className={`${TD_LEFT} text-muted`}>{row.round}</td>
                        <td className={TD_LEFT}>{row.teamID}</td>
                        <td className={TD_RIGHT}>{row.W}</td>
                        <td className={TD_RIGHT}>{row.L}</td>
                        <td className={TD_RIGHT_BOLD}>{fmtEra(eraVal)}</td>
                        <td className={TD_RIGHT}>{row.G}</td>
                        <td className={TD_RIGHT}>{row.GS}</td>
                        <td className={TD_RIGHT}>{row.SV}</td>
                        <td className={TD_RIGHT}>{inningsPitchedDisplay(ip)}</td>
                        <td className={TD_RIGHT}>{row.H}</td>
                        <td className={TD_RIGHT}>{row.ER}</td>
                        <td className={TD_RIGHT}>{row.HR}</td>
                        <td className={TD_RIGHT}>{row.BB}</td>
                        <td className={TD_RIGHT}>{row.SO}</td>
                        <td className={TD_RIGHT}>{fmtEra(whipVal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {careerPitchingPost && (
                  <tfoot className="border-t-2 border-border font-medium">
                    <tr>
                      <td className={`${TD_LEFT} font-medium`}>Career</td>
                      <td className={TD_LEFT}></td>
                      <td className={TD_LEFT}></td>
                      <td className={TD_RIGHT}>{careerPitchingPost.W}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.L}</td>
                      <td className={TD_RIGHT}>{fmtEra(era(careerPitchingPost.ER, careerPitchingPost.IPouts))}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.G}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.GS}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.SV}</td>
                      <td className={TD_RIGHT}>{inningsPitchedDisplay(careerPitchingPost.IPouts)}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.H}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.ER}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.HR}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.BB}</td>
                      <td className={TD_RIGHT}>{careerPitchingPost.SO}</td>
                      <td className={TD_RIGHT}>{fmtEra(whip(careerPitchingPost.BB, careerPitchingPost.H, careerPitchingPost.IPouts))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* 11. Hall of Fame Voting                                             */}
      {/* =================================================================== */}
      {hallOfFame.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Hall of Fame Voting
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Year", "Voted By", "Ballots", "Needed", "Votes", "Pct", "Inducted"].map(
                      (col) => (
                        <th
                          key={col}
                          className={
                            ["Year", "Voted By", "Inducted"].includes(col)
                              ? TH_LEFT
                              : TH_RIGHT
                          }
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {hallOfFame.map((row, i) => {
                    const pct =
                      row.ballots && row.ballots > 0 && row.votes != null
                        ? ((row.votes / row.ballots) * 100).toFixed(1) + "%"
                        : "\u2014";
                    return (
                      <tr key={i}>
                        <td className={`${TD_LEFT} font-medium`}>{row.yearid}</td>
                        <td className={TD_LEFT}>{row.votedBy}</td>
                        <td className={TD_RIGHT}>{row.ballots}</td>
                        <td className={TD_RIGHT}>{row.needed}</td>
                        <td className={TD_RIGHT}>{row.votes}</td>
                        <td className={TD_RIGHT}>{pct}</td>
                        <td className={TD_LEFT}>
                          {row.inducted === "Y" ? (
                            <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md dark:bg-amber-900/30 dark:text-amber-400">
                              Inducted
                            </span>
                          ) : (
                            <span className="text-muted text-xs">No</span>
                          )}
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

      {/* =================================================================== */}
      {/* 12. Salary History                                                  */}
      {/* =================================================================== */}
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
                    <th className={TH_LEFT}>Year</th>
                    <th className={TH_LEFT}>Team</th>
                    <th className={TH_RIGHT}>Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {salary.map((s, i) => (
                    <tr key={i}>
                      <td className={`${TD_LEFT} font-medium`}>{s.yearID}</td>
                      <td className={TD_LEFT}>{s.teamID}</td>
                      <td className={TD_RIGHT}>{fmtSalary(s.salary)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border font-medium">
                  <tr>
                    <td className={TD_LEFT} colSpan={2}>
                      Career Total
                    </td>
                    <td className={TD_RIGHT}>
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
