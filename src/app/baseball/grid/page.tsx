"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
      <div className={`flex ${isRow ? "flex-col" : "flex-col"} items-center gap-1`}>
        <img
          src={`https://www.mlbstatic.com/team-logos/${mlbId}.svg`}
          alt={cat.label}
          className="w-10 h-10 md:w-12 md:h-12 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        />
        <span className="text-[10px] md:text-[11px] font-semibold text-foreground/80 tracking-tight">
          {cat.label}
        </span>
      </div>
    );
  }

  // Non-team: clean text label, no boxes
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <span className="text-[10px] md:text-xs font-bold text-center leading-tight
        text-foreground/90 max-w-[70px] md:max-w-[90px]">
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
    <div className="max-w-[560px] mx-auto px-4 py-6 md:py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-foreground">
          Sporty Grid
        </h1>
        <p className="text-[11px] text-muted-light mt-1 font-mono tracking-wider">{grid.gridId}</p>
        <div className="flex items-center justify-center gap-3 mt-4">
          <GuessDots total={9} remaining={guessesLeft} />
          <span className="text-[11px] text-muted font-medium">
            {guessesLeft} left
          </span>
        </div>
      </div>

      {/* The Grid — real glass */}
      <div className="relative rounded-2xl overflow-hidden
        backdrop-blur-xl border border-white/10
        shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]
        bg-white/[0.06] dark:bg-white/[0.04]"
        style={{ WebkitBackdropFilter: "blur(24px)", backdropFilter: "blur(24px)" }}>
        {/* Liquid glass texture layers */}
        {/* Top edge refraction highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-20" />
        {/* Left edge refraction */}
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-white/15 via-transparent to-transparent pointer-events-none z-20" />
        {/* Subtle grain texture for glass feel */}
        <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.015] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Gradient sheen — liquid refraction */}
        <div className="absolute inset-0 pointer-events-none z-10
          bg-gradient-to-br from-white/[0.04] via-transparent to-white/[0.02]" />

        <div className="grid grid-cols-[80px_1fr_1fr_1fr]">
          {/* Top-left corner */}
          <div className="h-[72px] md:h-[80px]" />

          {/* Column headers — transparent, no box */}
          {grid.cols.map((col, ci) => (
            <div
              key={ci}
              className="h-[72px] md:h-[80px] flex items-center justify-center
                border-b border-white/[0.06]"
            >
              <CategoryHeader cat={col} position="col" />
            </div>
          ))}

          {/* Grid body */}
          {grid.rows.map((row, ri) => (
            <React.Fragment key={`row-${ri}`}>
              {/* Row header — transparent, no box */}
              <div className="h-[110px] md:h-[130px] flex items-center justify-center px-2
                border-r border-white/[0.06]">
                <CategoryHeader cat={row} position="row" />
              </div>

              {/* Cells */}
              {grid.cols.map((_, ci) => {
                const cell = cells[ri][ci];
                const isActive = activeCell?.[0] === ri && activeCell?.[1] === ci;
                const isShaking = shakeCell === `${ri}-${ci}`;

                // Correct cell
                if (cell.status === "correct") {
                  return (
                    <Link
                      key={`${ri}-${ci}`}
                      href={`/baseball/players/${cell.playerID}`}
                      className="relative group h-[110px] md:h-[130px] flex flex-col items-center justify-center
                        overflow-hidden transition-all duration-300
                        border-r border-b border-white/[0.04]
                        hover:brightness-110"
                    >
                      {cell.mlbamID ? (
                        <img
                          src={`https://midfield.mlbstatic.com/v1/people/${cell.mlbamID}/spots/120`}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover
                            opacity-90 group-hover:opacity-100 group-hover:scale-105
                            transition-all duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-green-500/10" />
                      )}
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {/* Green check */}
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-500/90
                        flex items-center justify-center z-10">
                        <span className="text-white text-[8px] font-bold">{"\u2713"}</span>
                      </div>
                      {/* Name */}
                      <span className="absolute bottom-2 inset-x-1 text-[9px] md:text-[10px]
                        leading-tight font-semibold text-white text-center z-10
                        drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {cell.playerName}
                      </span>
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
                    className={`h-[110px] md:h-[130px] transition-all duration-200
                      border-r border-b border-white/[0.04]
                      ${isActive
                        ? "bg-accent/10 shadow-[inset_0_0_20px_rgba(200,16,46,0.1)]"
                        : "bg-transparent hover:bg-white/[0.03]"
                      }
                      ${gameOver ? "opacity-30 cursor-not-allowed" : "cursor-pointer active:scale-[0.97]"}
                      ${isShaking ? "animate-[shake_0.4s_ease-in-out]" : ""}
                      flex items-center justify-center`}
                  >
                    {isActive && (
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full
                        border border-accent/30 bg-accent/5
                        flex items-center justify-center
                        animate-pulse">
                        <span className="text-accent/50 text-lg font-light">+</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* How to play — inside the glass card */}
        <details className="border-t border-white/[0.06]">
          <summary className="px-4 py-2.5 text-[10px] text-muted-light cursor-pointer
            hover:text-muted transition-colors select-none">
            How to play
          </summary>
          <div className="px-4 pb-3 text-[10px] text-muted leading-relaxed space-y-1">
            <p>Select a cell and name a player who matches <strong>both</strong> the row and column.</p>
            <p>Team + team: played for both. Team + stat: achieved with that team.</p>
            <p>Each player can only be used once. 9 guesses total.</p>
          </div>
        </details>
      </div>

      {/* Search panel */}
      {activeCell && !gameOver && (
        <div className="mb-5 animate-[fadeIn_0.15s_ease-out]">
          <div className="backdrop-blur-xl bg-surface/80 border border-white/[0.08] rounded-2xl
            shadow-[0_8px_32px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
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
          <div className="text-center py-8 px-6 rounded-2xl
            backdrop-blur-xl bg-surface/80 border border-white/[0.08]
            shadow-[0_8px_32px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]">
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
                  hover:bg-accent-light active:scale-[0.97] transition-all
                  shadow-[0_2px_12px_rgba(200,16,46,0.3)]"
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
