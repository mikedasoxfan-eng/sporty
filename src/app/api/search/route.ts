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
    players = await prisma.people.findMany({
      where: {
        AND: [
          { nameFirst: { startsWith: parts[0], mode: "insensitive" } },
          { nameLast: { startsWith: parts.slice(1).join(" "), mode: "insensitive" } },
        ],
      },
      select: {
        playerID: true,
        nameFirst: true,
        nameLast: true,
        nameSuffix: true,
        mlbamID: true,
        debut: true,
        finalGame: true,
      },
      orderBy: [{ finalGame: "desc" }],
      take: 10,
    });
  } else {
    // Match single term against last name primarily, then first name
    players = await prisma.people.findMany({
      where: {
        OR: [
          { nameLast: { startsWith: q, mode: "insensitive" } },
          { nameFirst: { startsWith: q, mode: "insensitive" } },
        ],
      },
      select: {
        playerID: true,
        nameFirst: true,
        nameLast: true,
        nameSuffix: true,
        mlbamID: true,
        debut: true,
        finalGame: true,
      },
      orderBy: [{ finalGame: "desc" }],
      take: 10,
    });
  }

  return NextResponse.json({ players });
}
