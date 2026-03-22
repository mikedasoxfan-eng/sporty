import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/nfl-teams-logos — returns a map of teamAbbr -> teamLogo URL
 */
export async function GET() {
  const teams = await prisma.nFLTeam.findMany({
    select: { teamAbbr: true, teamLogo: true },
  });

  const logos: Record<string, string> = {};
  for (const t of teams) {
    if (t.teamLogo) {
      logos[t.teamAbbr] = t.teamLogo;
    }
  }

  return NextResponse.json(logos);
}
