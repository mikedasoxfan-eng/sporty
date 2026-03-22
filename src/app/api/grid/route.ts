import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateDailyGrid,
  playerMatchesCategory,
  getCategoryLabel,
} from "@/lib/grid";

/**
 * GET /api/grid — returns today's grid configuration
 */
export async function GET() {
  const grid = generateDailyGrid();

  return NextResponse.json({
    gridId: grid.gridId,
    rows: grid.rows.map((r) => ({
      ...r,
      label: getCategoryLabel(r),
    })),
    cols: grid.cols.map((c) => ({
      ...c,
      label: getCategoryLabel(c),
    })),
  });
}

/**
 * POST /api/grid — validate a guess
 * Body: { playerName: string, row: number, col: number, gridId?: string }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { playerName, row, col, gridId } = body;

  if (typeof playerName !== "string" || typeof row !== "number" || typeof col !== "number") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const grid = generateDailyGrid(gridId);

  if (row < 0 || row > 2 || col < 0 || col > 2) {
    return NextResponse.json({ error: "Invalid cell" }, { status: 400 });
  }

  // Search for the player
  const parts = playerName.trim().split(/\s+/);
  let players;

  if (parts.length >= 2) {
    players = await prisma.people.findMany({
      where: {
        AND: [
          { nameFirst: { startsWith: parts[0], mode: "insensitive" } },
          {
            nameLast: {
              startsWith: parts.slice(1).join(" "),
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        playerID: true,
        nameFirst: true,
        nameLast: true,
        nameSuffix: true,
        mlbamID: true,
      },
      take: 5,
    });
  } else {
    players = await prisma.people.findMany({
      where: {
        nameLast: { startsWith: parts[0], mode: "insensitive" },
      },
      select: {
        playerID: true,
        nameFirst: true,
        nameLast: true,
        nameSuffix: true,
        mlbamID: true,
      },
      take: 5,
    });
  }

  if (players.length === 0) {
    return NextResponse.json({
      valid: false,
      error: "Player not found",
      suggestions: [],
    });
  }

  // Try each matching player
  const rowCat = grid.rows[row];
  const colCat = grid.cols[col];

  for (const player of players) {
    const [matchRow, matchCol] = await Promise.all([
      playerMatchesCategory(player.playerID, rowCat),
      playerMatchesCategory(player.playerID, colCat),
    ]);

    if (matchRow && matchCol) {
      return NextResponse.json({
        valid: true,
        player: {
          playerID: player.playerID,
          nameFirst: player.nameFirst,
          nameLast: player.nameLast,
          nameSuffix: player.nameSuffix,
          mlbamID: player.mlbamID,
        },
      });
    }
  }

  // Player found but doesn't match criteria
  return NextResponse.json({
    valid: false,
    error: `${players[0].nameFirst} ${players[0].nameLast} doesn't match both criteria`,
    suggestions: players.map((p) => ({
      playerID: p.playerID,
      name: `${p.nameFirst} ${p.nameLast}${p.nameSuffix ? ` ${p.nameSuffix}` : ""}`,
    })),
  });
}
