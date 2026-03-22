"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Category {
  kind: string;
  label: string;
  teamID?: string;
}

interface GridConfig {
  gridId: string;
  rows: Category[];
  cols: Category[];
}

interface CellState {
  status: "empty" | "correct" | "wrong";
  playerName?: string;
  playerID?: string;
  mlbamID?: number;
}

// MLB team ID mapping for logos
const TEAM_MLB_ID: Record<string, number> = {
  NYA: 147, BOS: 111, LAN: 119, SFN: 137, CHN: 112, SLN: 138,
  CIN: 113, ATL: 144, PHI: 143, PIT: 134, CLE: 114, DET: 116,
  CHA: 145, MIN: 142, HOU: 117, BAL: 110, KCA: 118, OAK: 133,
  SEA: 136, TEX: 140, ANA: 108, NYN: 121, SDN: 135, COL: 115,
  ARI: 109, MIL: 158, TBA: 139, TOR: 141, MIA: 146, WAS: 120,
};

function CategoryHeader({ cat }: { cat: Category }) {
  const teamID = cat.teamID;
  const mlbId = teamID ? TEAM_MLB_ID[teamID] : null;

  if (mlbId) {
    return (
      <div className="flex flex-col items-center gap-1">
        <img
          src={`https://www.mlbstatic.com/team-logos/${mlbId}.svg`}
          alt={cat.label}
          className="w-8 h-8 md:w-10 md:h-10"
        />
        <span className="text-[10px] md:text-xs font-medium text-muted">
          {cat.label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-1">
      <span className="text-[10px] md:text-xs font-semibold text-center leading-tight">
        {cat.label}
      </span>
    </div>
  );
}

export default function GridPage() {
  const [grid, setGrid] = useState<GridConfig | null>(null);
  const [cells, setCells] = useState<CellState[][]>(
    Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => ({ status: "empty" as const }))
    )
  );
  const [guessesLeft, setGuessesLeft] = useState(9);
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { playerID: string; nameFirst: string; nameLast: string; nameSuffix?: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load grid config
  useEffect(() => {
    fetch("/api/grid")
      .then((r) => r.json())
      .then(setGrid)
      .catch(() => {});
  }, []);

  // Search as user types
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.players || []);
        }
      } catch {
        // aborted
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  // Focus input when cell selected
  useEffect(() => {
    if (activeCell) inputRef.current?.focus();
  }, [activeCell]);

  async function submitGuess(playerName: string) {
    if (!activeCell || !grid || gameOver) return;
    const [row, col] = activeCell;

    setError(null);
    try {
      const res = await fetch("/api/grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName,
          row,
          col,
          gridId: grid.gridId,
        }),
      });
      const data = await res.json();

      const newCells = cells.map((r) => r.map((c) => ({ ...c })));
      const remaining = guessesLeft - 1;

      if (data.valid) {
        newCells[row][col] = {
          status: "correct",
          playerName: `${data.player.nameFirst} ${data.player.nameLast}`,
          playerID: data.player.playerID,
          mlbamID: data.player.mlbamID,
        };
        setCells(newCells);
        setActiveCell(null);
        setSearchQuery("");
        setSearchResults([]);
      } else {
        setError(data.error || "Incorrect");
      }

      setGuessesLeft(remaining);
      if (remaining <= 0) setGameOver(true);

      // Check if all cells filled
      const allFilled = newCells.every((r) =>
        r.every((c) => c.status === "correct")
      );
      if (allFilled) setGameOver(true);
    } catch {
      setError("Connection error");
    }
  }

  const correctCount = cells.flat().filter((c) => c.status === "correct").length;

  if (!grid) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-16 text-center">
        <p className="text-muted">Loading grid...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tighter">
          Sporty Grid
        </h1>
        <p className="text-sm text-muted mt-1">
          {grid.gridId} &middot; {guessesLeft} guesses left &middot;{" "}
          {correctCount}/9
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-1 mb-6">
        {/* Top-left empty cell */}
        <div />

        {/* Column headers */}
        {grid.cols.map((col, ci) => (
          <div
            key={ci}
            className="flex items-center justify-center h-16 md:h-20"
          >
            <CategoryHeader cat={col} />
          </div>
        ))}

        {/* Rows */}
        {grid.rows.map((row, ri) => (
          <>
            {/* Row header */}
            <div
              key={`rh-${ri}`}
              className="flex items-center justify-center h-20 md:h-24"
            >
              <CategoryHeader cat={row} />
            </div>

            {/* Cells */}
            {grid.cols.map((_, ci) => {
              const cell = cells[ri][ci];
              const isActive =
                activeCell?.[0] === ri && activeCell?.[1] === ci;

              if (cell.status === "correct") {
                return (
                  <div
                    key={`${ri}-${ci}`}
                    className="h-20 md:h-24 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900
                      flex flex-col items-center justify-center p-1 text-center"
                  >
                    {cell.mlbamID && (
                      <img
                        src={`https://midfield.mlbstatic.com/v1/people/${cell.mlbamID}/spots/60`}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover mb-0.5"
                      />
                    )}
                    <span className="text-[9px] md:text-[10px] leading-tight font-medium text-green-800 dark:text-green-300">
                      {cell.playerName}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={`${ri}-${ci}`}
                  onClick={() => {
                    if (!gameOver) {
                      setActiveCell([ri, ci]);
                      setSearchQuery("");
                      setSearchResults([]);
                      setError(null);
                    }
                  }}
                  disabled={gameOver}
                  className={`h-20 md:h-24 rounded-lg border transition-all
                    ${
                      isActive
                        ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                        : "border-border bg-surface hover:bg-surface-alt"
                    }
                    ${gameOver ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    flex items-center justify-center`}
                >
                  {isActive && (
                    <span className="text-xs text-accent font-medium">?</span>
                  )}
                </button>
              );
            })}
          </>
        ))}
      </div>

      {/* Search input */}
      {activeCell && !gameOver && (
        <div className="mb-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a player name..."
              className="w-full h-11 px-4 text-sm bg-surface border border-border rounded-lg
                placeholder:text-muted-light focus:outline-none focus:ring-2 focus:ring-accent/30
                focus:border-accent/50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 mt-2">{error}</p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-1 border border-border rounded-lg bg-surface overflow-hidden shadow-lg">
              {searchResults.map((p) => (
                <button
                  key={p.playerID}
                  onClick={() =>
                    submitGuess(
                      `${p.nameFirst} ${p.nameLast}${p.nameSuffix ? ` ${p.nameSuffix}` : ""}`
                    )
                  }
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-alt transition-colors
                    flex items-center justify-between"
                >
                  <span className="font-medium">
                    {p.nameFirst} {p.nameLast}
                    {p.nameSuffix ? ` ${p.nameSuffix}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Game over */}
      {gameOver && (
        <div className="text-center py-6 border border-border rounded-lg bg-surface">
          <p className="text-lg font-semibold">
            {correctCount === 9 ? "Perfect!" : `${correctCount}/9`}
          </p>
          <p className="text-sm text-muted mt-1">
            {correctCount === 9
              ? "You completed the grid!"
              : `Game over. You got ${correctCount} correct.`}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm bg-accent text-white rounded-lg
              hover:bg-accent-light transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center">
        <Link
          href="/baseball"
          className="text-sm text-link hover:text-link-hover transition-colors"
        >
          Back to Baseball
        </Link>
      </div>
    </div>
  );
}
