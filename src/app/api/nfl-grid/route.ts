import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateNFLDailyGrid,
  nflPlayerMatchesCategory,
  getNFLCategoryLabel,
} from "@/lib/nfl-grid";

/**
 * GET /api/nfl-grid — returns today's NFL grid configuration
 */
export async function GET() {
  const grid = generateNFLDailyGrid();

  return NextResponse.json({
    gridId: grid.gridId,
    rows: grid.rows.map((r) => ({
      ...r,
      label: getNFLCategoryLabel(r),
    })),
    cols: grid.cols.map((c) => ({
      ...c,
      label: getNFLCategoryLabel(c),
    })),
  });
}

/**
 * POST /api/nfl-grid — validate a guess
 * Body: { playerId: string, row: number, col: number, gridId?: string }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { playerId, row, col, gridId } = body;

  if (typeof playerId !== "string" || typeof row !== "number" || typeof col !== "number") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const grid = generateNFLDailyGrid(gridId);

  if (row < 0 || row > 2 || col < 0 || col > 2) {
    return NextResponse.json({ error: "Invalid cell" }, { status: 400 });
  }

  // Look up the player
  const player = await prisma.nFLPlayer.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      position: true,
      headshot: true,
      latestTeam: true,
    },
  });

  if (!player) {
    return NextResponse.json({
      valid: false,
      error: "Player not found",
    });
  }

  const rowCat = grid.rows[row];
  const colCat = grid.cols[col];

  const [matchRow, matchCol] = await Promise.all([
    nflPlayerMatchesCategory(player.id, rowCat),
    nflPlayerMatchesCategory(player.id, colCat),
  ]);

  if (matchRow && matchCol) {
    return NextResponse.json({
      valid: true,
      player: {
        id: player.id,
        displayName: player.displayName || `${player.firstName} ${player.lastName}`,
        headshot: player.headshot,
        position: player.position,
        latestTeam: player.latestTeam,
      },
    });
  }

  const name = player.displayName || `${player.firstName} ${player.lastName}`;
  return NextResponse.json({
    valid: false,
    error: `${name} doesn't match both criteria`,
  });
}
