import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  battingAvg,
  onBasePct,
  sluggingPct,
  ops,
  era,
  whip,
  inningsPitchedDisplay,
  plateAppearances,
} from "@/lib/stats";

export async function GET(request: NextRequest) {
  const p1 = request.nextUrl.searchParams.get("p1");
  const p2 = request.nextUrl.searchParams.get("p2");

  if (!p1 || !p2) {
    return NextResponse.json(
      { error: "Both p1 and p2 query parameters are required" },
      { status: 400 }
    );
  }

  try {
    const [player1, player2] = await Promise.all([
      getPlayerData(p1),
      getPlayerData(p2),
    ]);

    if (!player1 || !player2) {
      return NextResponse.json(
        { error: "One or both players not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ player1, player2 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch player data" },
      { status: 500 }
    );
  }
}

async function getPlayerData(playerID: string) {
  const player = await prisma.people.findUnique({
    where: { playerID },
    select: {
      playerID: true,
      nameFirst: true,
      nameLast: true,
      nameGiven: true,
      nameSuffix: true,
      debut: true,
      finalGame: true,
      bats: true,
      throws: true,
    },
  });

  if (!player) return null;

  const [battingRows, pitchingRows] = await Promise.all([
    prisma.batting.findMany({ where: { playerID } }),
    prisma.pitching.findMany({ where: { playerID } }),
  ]);

  // Aggregate career batting totals
  const bat = {
    G: 0,
    AB: 0,
    R: 0,
    H: 0,
    doubles: 0,
    triples: 0,
    HR: 0,
    RBI: 0,
    SB: 0,
    CS: 0,
    BB: 0,
    SO: 0,
    HBP: 0,
    SH: 0,
    SF: 0,
    IBB: 0,
  };

  for (const b of battingRows) {
    bat.G += b.G || 0;
    bat.AB += b.AB || 0;
    bat.R += b.R || 0;
    bat.H += b.H || 0;
    bat.doubles += b.doubles || 0;
    bat.triples += b.triples || 0;
    bat.HR += b.HR || 0;
    bat.RBI += b.RBI || 0;
    bat.SB += b.SB || 0;
    bat.CS += b.CS || 0;
    bat.BB += b.BB || 0;
    bat.SO += b.SO || 0;
    bat.HBP += b.HBP || 0;
    bat.SH += b.SH || 0;
    bat.SF += b.SF || 0;
    bat.IBB += b.IBB || 0;
  }

  const pa = plateAppearances(bat.AB, bat.BB, bat.HBP, bat.SH, bat.SF);
  const avg = battingAvg(bat.H, bat.AB);
  const obp = onBasePct(bat.H, bat.BB, bat.HBP, bat.AB, bat.SF);
  const slg = sluggingPct(bat.H, bat.doubles, bat.triples, bat.HR, bat.AB);
  const opsVal = ops(obp, slg);

  // Aggregate career pitching totals
  const pit = {
    W: 0,
    L: 0,
    G: 0,
    GS: 0,
    SV: 0,
    IPouts: 0,
    H: 0,
    ER: 0,
    HR: 0,
    BB: 0,
    SO: 0,
    HBP: 0,
  };

  for (const p of pitchingRows) {
    pit.W += p.W || 0;
    pit.L += p.L || 0;
    pit.G += p.G || 0;
    pit.GS += p.GS || 0;
    pit.SV += p.SV || 0;
    pit.IPouts += p.IPouts || 0;
    pit.H += p.H || 0;
    pit.ER += p.ER || 0;
    pit.HR += p.HR || 0;
    pit.BB += p.BB || 0;
    pit.SO += p.SO || 0;
    pit.HBP += p.HBP || 0;
  }

  const eraVal = era(pit.ER, pit.IPouts);
  const whipVal = whip(pit.BB, pit.H, pit.IPouts);
  const ipDisplay = inningsPitchedDisplay(pit.IPouts);

  return {
    bio: player,
    hasBatting: battingRows.length > 0,
    hasPitching: pitchingRows.length > 0,
    batting: {
      ...bat,
      PA: pa,
      BA: avg,
      OBP: obp,
      SLG: slg,
      OPS: opsVal,
    },
    pitching: {
      ...pit,
      ERA: eraVal,
      WHIP: whipVal,
      IP: ipDisplay,
    },
  };
}
