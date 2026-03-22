import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const season = request.nextUrl.searchParams.get("season");
  const type = request.nextUrl.searchParams.get("type") || "hitting";

  if (!playerId || !season) {
    return NextResponse.json(
      { error: "playerId and season are required" },
      { status: 400 }
    );
  }

  if (type !== "hitting" && type !== "pitching") {
    return NextResponse.json(
      { error: 'type must be "hitting" or "pitching"' },
      { status: 400 }
    );
  }

  // Look up mlbamID from People table
  const player = await prisma.people.findUnique({
    where: { playerID: playerId },
    select: { mlbamID: true },
  });

  if (!player?.mlbamID) {
    return NextResponse.json(
      { error: "Player not found or missing MLB Stats API ID" },
      { status: 404 }
    );
  }

  const mlbamID = player.mlbamID;
  const url = `https://statsapi.mlb.com/api/v1/people/${mlbamID}/stats?stats=gameLog&season=${season}&group=${type}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: `MLB API returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const splits = data?.stats?.[0]?.splits ?? [];

    return NextResponse.json(
      { splits },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch from MLB Stats API" },
      { status: 502 }
    );
  }
}
