import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  // Split query into parts for "first last" matching
  const parts = q.split(/\s+/);

  let players;

  if (parts.length >= 2) {
    // Match "first last" pattern
    players = await prisma.nFLPlayer.findMany({
      where: {
        AND: [
          { firstName: { startsWith: parts[0], mode: "insensitive" } },
          {
            lastName: {
              startsWith: parts.slice(1).join(" "),
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        position: true,
        latestTeam: true,
        headshot: true,
        rookieSeason: true,
        lastSeason: true,
      },
      orderBy: [{ lastSeason: "desc" }],
      take: 10,
    });
  } else {
    // Match single term against last name primarily, then first name
    players = await prisma.nFLPlayer.findMany({
      where: {
        OR: [
          { lastName: { startsWith: q, mode: "insensitive" } },
          { firstName: { startsWith: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        position: true,
        latestTeam: true,
        headshot: true,
        rookieSeason: true,
        lastSeason: true,
      },
      orderBy: [{ lastSeason: "desc" }],
      take: 10,
    });
  }

  return NextResponse.json({ players });
}
