"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

const TEAM_MLB_ID: Record<string, number> = {
  NYA: 147, BOS: 111, LAN: 119, SFN: 137, CHN: 112, SLN: 138,
  CIN: 113, ATL: 144, PHI: 143, PIT: 134, CLE: 114, DET: 116,
  CHA: 145, MIN: 142, HOU: 117, BAL: 110, KCA: 118, OAK: 133,
  SEA: 136, TEX: 140, ANA: 108, NYN: 121, SDN: 135, COL: 115,
  ARI: 109, MIL: 158, TBA: 139, TOR: 141, MIA: 146, WAS: 120,
};

// Category icons for non-team categories
const CATEGORY_ICONS: Record<string, string> = {
  allstar: "/icons/star.svg",
  hof: "/icons/plaque.svg",
  ws_champ: "/icons/trophy.svg",
};

/* ------------------------------------------------------------------ */
/* Category header — teams get logos, stats get styled badges          */
/* ------------------------------------------------------------------ */
function CategoryHeader({ cat, position }: { cat: Category; position: "row" | "col" }) {
  const teamID = cat.teamID;
  const mlbId = teamID ? TEAM_MLB_ID[teamID] : null;
  const isRow = position === "row";

  if (mlbId) {
    return (
      <div className={`flex ${isRow ? "flex-row" : "flex-col"} items-center gap-1.5`}>
        <img
          src={`https://www.mlbstatic.com/team-logos/${mlbId}.svg`}
          alt={cat.label}
          className="w-9 h-9 md:w-11 md:h-11 drop-shadow-sm"
        />
        <span className="text-[10px] md:text-xs font-semibold text-foreground tracking-tight">
          {cat.label}
        </span>
      </div>
    );
  }

  // Non-team: stat milestones, awards, etc.
  const isAward = cat.kind === "award" || cat.kind === "allstar" || cat.kind === "hof";

  return (
    <div className={`flex ${isRow ? "flex-row" : "flex-col"} items-center gap-1 px-1`}>
      {isAward && (
        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
          <span className="text-xs md:text-sm">
            {cat.kind === "hof" ? "\u2605" : cat.kind === "ws_champ" ? "\u2606" : "\u2726"}
          </span>
        </div>
      )}
      {!isAward && (
        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] md:text-xs font-bold text-accent">#</span>
        </div>
      )}
      <span className="text-[9px] md:text-[11px] font-semibold text-center leading-tight max-w-[70px] md:max-w-[90px]">
        {cat.label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Guess counter dots                                                  */
/* ------------------------------------------------------------------ */
function GuessDots({ total, remaining }: { total: number; remaining: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all duration-300
            ${i < total - remaining ? "bg-accent scale-100" : "bg-border scale-100"}`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main grid page                                                      */
/* ------------------------------------------------------------------ */
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
    { playerID: string; nameFirst: string; nameLast: string; nameSuffix?: string; mlbamID?: number }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shakeCell, setShakeCell] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/grid")
      .then((r) => r.json())
      .then(setGrid)
      .catch(() => {});
  }, []);

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
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    if (activeCell) {
      inputRef.current?.focus();
    }
  }, [activeCell]);

  // Close search on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveCell(null);
        setSearchQuery("");
        setSearchResults([]);
        setError(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const submitGuess = useCallback(
    async (playerName: string) => {
      if (!activeCell || !grid || gameOver || submitting) return;
      const [row, col] = activeCell;

      setError(null);
      setSubmitting(true);

      try {
        const res = await fetch("/api/grid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName, row, col, gridId: grid.gridId }),
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
          setShakeCell(`${row}-${col}`);
          setTimeout(() => setShakeCell(null), 500);
        }

        setGuessesLeft(remaining);
        if (remaining <= 0) {
          setGameOver(true);
          setActiveCell(null);
        }

        const allFilled = newCells.every((r) =>
          r.every((c) => c.status === "correct")
        );
        if (allFilled) {
          setGameOver(true);
          setActiveCell(null);
        }
      } catch {
        setError("Connection error");
      } finally {
        setSubmitting(false);
      }
    },
    [activeCell, grid, gameOver, submitting, cells, guessesLeft]
  );

  const correctCount = cells.flat().filter((c) => c.status === "correct").length;

  // Loading state
  if (!grid) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-border border-t-accent animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted">Loading today&apos;s grid...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[540px] mx-auto px-4 py-6 md:py-10">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter text-foreground">
          Sporty Grid
        </h1>
        <p className="text-xs text-muted mt-1.5 font-mono">{grid.gridId}</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <GuessDots total={9} remaining={guessesLeft} />
          <span className="text-xs text-muted">
            {guessesLeft} remaining
          </span>
        </div>
      </div>

      {/* The Grid */}
      <div className="grid grid-cols-[minmax(70px,80px)_1fr_1fr_1fr] gap-[3px] md:gap-1 mb-5">
        {/* Top-left corner — empty */}
        <div className="rounded-tl-xl" />

        {/* Column headers */}
        {grid.cols.map((col, ci) => (
          <div
            key={ci}
            className={`flex items-center justify-center py-3 md:py-4 bg-surface-alt
              ${ci === 2 ? "rounded-tr-xl" : ""}`}
          >
            <CategoryHeader cat={col} position="col" />
          </div>
        ))}

        {/* Grid body */}
        {grid.rows.map((row, ri) => (
          <>
            {/* Row header */}
            <div
              key={`rh-${ri}`}
              className={`flex items-center justify-center px-1 bg-surface-alt
                ${ri === 2 ? "rounded-bl-xl" : ""}`}
            >
              <CategoryHeader cat={row} position="row" />
            </div>

            {/* Cells */}
            {grid.cols.map((_, ci) => {
              const cell = cells[ri][ci];
              const isActive = activeCell?.[0] === ri && activeCell?.[1] === ci;
              const isShaking = shakeCell === `${ri}-${ci}`;
              const isLastRow = ri === 2;
              const isLastCol = ci === 2;
              const cornerClass = isLastRow && isLastCol ? "rounded-br-xl" : "";

              // Correct cell
              if (cell.status === "correct") {
                return (
                  <Link
                    key={`${ri}-${ci}`}
                    href={`/baseball/players/${cell.playerID}`}
                    className={`relative group aspect-square flex flex-col items-center justify-center
                      bg-green-50 dark:bg-green-950/30 border border-green-200/60 dark:border-green-900/60
                      overflow-hidden transition-transform hover:scale-[1.02] ${cornerClass}`}
                  >
                    {cell.mlbamID ? (
                      <img
                        src={`https://midfield.mlbstatic.com/v1/people/${cell.mlbamID}/spots/120`}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-green-100 dark:bg-green-900/40" />
                    )}
                    {/* Name overlay at bottom */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1 pb-1 pt-4">
                      <span className="text-[8px] md:text-[10px] leading-tight font-semibold text-white drop-shadow-sm block text-center">
                        {cell.playerName}
                      </span>
                    </div>
                  </Link>
                );
              }

              // Empty cell
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
                  className={`aspect-square border transition-all duration-200 ${cornerClass}
                    ${isActive
                      ? "border-accent bg-accent/8 ring-2 ring-accent/25 scale-[1.03] z-10"
                      : "border-border bg-surface hover:bg-surface-alt hover:border-muted-light"
                    }
                    ${gameOver ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-95"}
                    ${isShaking ? "animate-[shake_0.4s_ease-in-out]" : ""}
                    flex items-center justify-center`}
                >
                  {isActive && (
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-dashed border-accent/40 flex items-center justify-center">
                      <span className="text-sm md:text-base text-accent/60">+</span>
                    </div>
                  )}
                </button>
              );
            })}
          </>
        ))}
      </div>

      {/* Search panel */}
      {activeCell && !gameOver && (
        <div className="mb-5 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-surface border border-border rounded-xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.12)] overflow-hidden">
            {/* Search header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-light">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-muted text-sm">Search</span>
                <span className="text-[10px] text-muted-light px-1.5 py-0.5 rounded bg-surface-alt font-mono">
                  {grid.rows[activeCell[0]].label} + {grid.cols[activeCell[1]].label}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveCell(null);
                  setSearchQuery("");
                  setSearchResults([]);
                  setError(null);
                }}
                className="text-muted hover:text-foreground transition-colors text-lg leading-none"
              >
                x
              </button>
            </div>

            {/* Input */}
            <div className="px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a player name..."
                className="w-full h-10 px-3 text-sm bg-surface-alt border border-border rounded-lg
                  placeholder:text-muted-light focus:outline-none focus:ring-2 focus:ring-accent/20
                  focus:border-accent/40 transition-all"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="border-t border-border-light max-h-[240px] overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.playerID}
                    onClick={() =>
                      submitGuess(
                        `${p.nameFirst} ${p.nameLast}${p.nameSuffix ? ` ${p.nameSuffix}` : ""}`
                      )
                    }
                    disabled={submitting}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3
                      hover:bg-surface-alt active:bg-accent/5 transition-colors
                      disabled:opacity-50 border-b border-border-light last:border-0"
                  >
                    {p.mlbamID && (
                      <img
                        src={`https://midfield.mlbstatic.com/v1/people/${p.mlbamID}/spots/60`}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover bg-surface-alt flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <span className="text-sm font-medium">
                      {p.nameFirst} {p.nameLast}
                      {p.nameSuffix ? ` ${p.nameSuffix}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Empty state */}
            {searchQuery.length >= 2 && searchResults.length === 0 && !error && (
              <div className="px-4 pb-4">
                <p className="text-xs text-muted text-center py-3">No players found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div className="mb-6 animate-[fadeIn_0.3s_ease-out]">
          <div className="text-center py-8 px-6 border border-border rounded-2xl bg-surface
            shadow-[0_8px_30px_-10px_rgba(0,0,0,0.1)]">
            {correctCount === 9 ? (
              <>
                <div className="text-4xl mb-3">9/9</div>
                <p className="text-lg font-bold text-foreground">Immaculate!</p>
                <p className="text-sm text-muted mt-1">You completed the entire grid.</p>
              </>
            ) : (
              <>
                <p className="text-4xl font-bold text-foreground mb-2">{correctCount}/9</p>
                <p className="text-sm text-muted">
                  {correctCount === 0
                    ? "Better luck tomorrow."
                    : correctCount <= 3
                      ? "Not bad, keep practicing."
                      : correctCount <= 6
                        ? "Solid effort!"
                        : "So close!"}
                </p>
              </>
            )}
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                onClick={() => {
                  setCells(
                    Array.from({ length: 3 }, () =>
                      Array.from({ length: 3 }, () => ({ status: "empty" as const }))
                    )
                  );
                  setGuessesLeft(9);
                  setGameOver(false);
                  setActiveCell(null);
                  setError(null);
                }}
                className="px-5 py-2.5 text-sm font-medium bg-accent text-white rounded-xl
                  hover:bg-accent-light active:scale-[0.97] transition-all"
              >
                Play Again
              </button>
              <Link
                href="/baseball"
                className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl
                  hover:bg-surface-alt transition-colors"
              >
                Stats
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* How to play (collapsed) */}
      <details className="mb-6">
        <summary className="text-xs text-muted cursor-pointer hover:text-foreground transition-colors">
          How to play
        </summary>
        <div className="mt-2 text-xs text-muted leading-relaxed space-y-1.5 pl-3 border-l-2 border-border">
          <p>Select a cell and name a player who matches <strong>both</strong> the row and column criteria.</p>
          <p>For team + team: the player must have played for both teams.</p>
          <p>For team + stat: the stat must have been achieved with that team (single-season stats) or the player just needs to have played for the team (career stats).</p>
          <p>Each player can only be used once. You have 9 guesses.</p>
        </div>
      </details>

      {/* Retrosheet credit */}
      <p className="text-center text-[10px] text-muted-light">
        Data from Lahman Database and Retrosheet
      </p>

      {/* CSS animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
