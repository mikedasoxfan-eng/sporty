"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface PlayerSearchResult {
  playerID: string;
  nameFirst: string | null;
  nameLast: string | null;
  nameSuffix: string | null;
  debut: string | null;
  finalGame: string | null;
}

interface PlayerData {
  bio: {
    playerID: string;
    nameFirst: string | null;
    nameLast: string | null;
    nameGiven: string | null;
    nameSuffix: string | null;
    debut: string | null;
    finalGame: string | null;
    bats: string | null;
    throws: string | null;
  };
  hasBatting: boolean;
  hasPitching: boolean;
  batting: {
    G: number;
    AB: number;
    R: number;
    H: number;
    doubles: number;
    triples: number;
    HR: number;
    RBI: number;
    SB: number;
    CS: number;
    BB: number;
    SO: number;
    PA: number;
    BA: number | null;
    OBP: number | null;
    SLG: number | null;
    OPS: number | null;
  };
  pitching: {
    W: number;
    L: number;
    G: number;
    GS: number;
    SV: number;
    IPouts: number;
    H: number;
    ER: number;
    HR: number;
    BB: number;
    SO: number;
    ERA: number | null;
    WHIP: number | null;
    IP: string;
  };
}

function formatName(p: { nameFirst: string | null; nameLast: string | null; nameSuffix?: string | null }): string {
  const base = [p.nameFirst, p.nameLast].filter(Boolean).join(" ");
  if (p.nameSuffix && p.nameLast && !p.nameLast.includes(p.nameSuffix)) {
    return `${base} ${p.nameSuffix}`;
  }
  return base;
}

function fmtAvg(val: number | null): string {
  if (val === null) return "---";
  const str = val.toFixed(3);
  return str.startsWith("0") ? str.slice(1) : str;
}

function fmtEra(val: number | null): string {
  if (val === null) return "---";
  return val.toFixed(2);
}

function PlayerSearch({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: PlayerSearchResult | null;
  onSelect: (p: PlayerSearchResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.players || []);
      setOpen(true);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  if (selected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
        <span className="text-sm font-medium">{formatName(selected)}</span>
        <button
          onClick={() => {
            onSelect(null);
            setQuery("");
            setResults([]);
          }}
          className="text-xs text-muted hover:text-foreground transition-colors border border-border rounded px-2 py-0.5"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="text-xs text-muted uppercase tracking-wider block mb-1">
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search by name..."
        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-border rounded-md bg-surface shadow-lg max-h-60 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.playerID}
              onMouseDown={() => {
                onSelect(p);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-alt transition-colors flex items-center justify-between"
            >
              <span>{formatName(p)}</span>
              <span className="text-xs text-muted font-mono">
                {p.debut?.slice(0, 4)}–{p.finalGame?.slice(0, 4)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type BattingStat = "G" | "AB" | "R" | "H" | "HR" | "RBI" | "SB" | "BB" | "SO" | "BA" | "OBP" | "SLG" | "OPS";
type PitchingStat = "W" | "L" | "ERA" | "G" | "GS" | "SV" | "IP" | "SO" | "WHIP";

function getLeader(
  v1: number | string | null,
  v2: number | string | null,
  lower = false
): "p1" | "p2" | "tie" {
  const n1 = typeof v1 === "string" ? parseFloat(v1) : v1;
  const n2 = typeof v2 === "string" ? parseFloat(v2) : v2;
  if (n1 === null || n2 === null || isNaN(n1 as number) || isNaN(n2 as number)) return "tie";
  if (n1 === n2) return "tie";
  if (lower) return (n1 as number) < (n2 as number) ? "p1" : "p2";
  return (n1 as number) > (n2 as number) ? "p1" : "p2";
}

export default function ComparePage() {
  const [player1, setPlayer1] = useState<PlayerSearchResult | null>(null);
  const [player2, setPlayer2] = useState<PlayerSearchResult | null>(null);
  const [data, setData] = useState<{ player1: PlayerData; player2: PlayerData } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!player1 || !player2) {
      setData(null);
      return;
    }

    async function fetchComparison() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/compare?p1=${player1!.playerID}&p2=${player2!.playerID}`
        );
        const json = await res.json();
        if (json.player1 && json.player2) {
          setData(json);
        }
      } catch {
        // silently fail
      }
      setLoading(false);
    }

    fetchComparison();
  }, [player1, player2]);

  const battingStats: { key: BattingStat; label: string; format?: (v: number | null) => string }[] = [
    { key: "G", label: "G" },
    { key: "AB", label: "AB" },
    { key: "R", label: "R" },
    { key: "H", label: "H" },
    { key: "HR", label: "HR" },
    { key: "RBI", label: "RBI" },
    { key: "SB", label: "SB" },
    { key: "BB", label: "BB" },
    { key: "SO", label: "SO" },
    { key: "BA", label: "BA", format: fmtAvg },
    { key: "OBP", label: "OBP", format: fmtAvg },
    { key: "SLG", label: "SLG", format: fmtAvg },
    { key: "OPS", label: "OPS", format: fmtAvg },
  ];

  const pitchingStats: { key: PitchingStat; label: string; lower?: boolean; format?: (v: number | null) => string }[] = [
    { key: "W", label: "W" },
    { key: "L", label: "L", lower: true },
    { key: "ERA", label: "ERA", lower: true, format: fmtEra },
    { key: "G", label: "G" },
    { key: "GS", label: "GS" },
    { key: "SV", label: "SV" },
    { key: "IP", label: "IP" },
    { key: "SO", label: "SO" },
    { key: "WHIP", label: "WHIP", lower: true, format: fmtEra },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/baseball"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Baseball
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          Player Comparison
        </h1>
        <p className="text-muted mt-2 text-sm">
          Compare career statistics side by side
        </p>
      </div>

      {/* Player selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <PlayerSearch label="Player 1" selected={player1} onSelect={setPlayer1} />
        <PlayerSearch label="Player 2" selected={player2} onSelect={setPlayer2} />
      </div>

      {loading && (
        <p className="text-muted text-sm">Loading comparison...</p>
      )}

      {data && (
        <div className="space-y-10">
          {/* Bio comparison */}
          <section className="grid grid-cols-2 gap-4">
            {[data.player1, data.player2].map((p) => (
              <div key={p.bio.playerID} className="border border-border rounded-lg bg-surface p-4">
                <Link
                  href={`/baseball/players/${p.bio.playerID}`}
                  className="text-link hover:text-link-hover hover:underline transition-colors font-medium"
                >
                  {formatName(p.bio)}
                </Link>
                <div className="mt-2 text-xs text-muted space-y-0.5">
                  <p>
                    {p.bio.debut?.slice(0, 4)}–{p.bio.finalGame?.slice(0, 4)}
                  </p>
                  <p>Bats: {p.bio.bats || "—"} / Throws: {p.bio.throws || "—"}</p>
                </div>
              </div>
            ))}
          </section>

          {/* Batting comparison */}
          {(data.player1.hasBatting || data.player2.hasBatting) && (
            <section>
              <h2 className="text-lg font-semibold tracking-tight mb-4">
                Career Batting
              </h2>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-1/3">
                        {formatName(data.player1.bio)}
                      </th>
                      <th className="py-2 px-3 text-center text-xs font-medium text-muted uppercase tracking-wider">
                        Stat
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-1/3">
                        {formatName(data.player2.bio)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {battingStats.map(({ key, label, format }) => {
                      const v1 = data.player1.batting[key];
                      const v2 = data.player2.batting[key];
                      const leader = getLeader(v1, v2, key === "SO");
                      const fmt = format || ((v: number | null) => v !== null ? String(v) : "—");
                      return (
                        <tr key={key}>
                          <td
                            className={`py-2 px-3 text-right font-mono text-xs ${leader === "p1" ? "font-bold text-accent" : ""}`}
                          >
                            {fmt(v1 as number | null)}
                          </td>
                          <td className="py-2 px-3 text-center text-xs font-medium text-muted uppercase tracking-wider">
                            {label}
                          </td>
                          <td
                            className={`py-2 px-3 text-left font-mono text-xs ${leader === "p2" ? "font-bold text-accent" : ""}`}
                          >
                            {fmt(v2 as number | null)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Pitching comparison */}
          {(data.player1.hasPitching || data.player2.hasPitching) && (
            <section>
              <h2 className="text-lg font-semibold tracking-tight mb-4">
                Career Pitching
              </h2>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-1/3">
                        {formatName(data.player1.bio)}
                      </th>
                      <th className="py-2 px-3 text-center text-xs font-medium text-muted uppercase tracking-wider">
                        Stat
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-1/3">
                        {formatName(data.player2.bio)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {pitchingStats.map(({ key, label, lower, format }) => {
                      const v1 = data.player1.pitching[key];
                      const v2 = data.player2.pitching[key];
                      const leader = getLeader(v1, v2, lower);
                      const fmt = format || ((v: number | string | null) => v !== null ? String(v) : "—");
                      return (
                        <tr key={key}>
                          <td
                            className={`py-2 px-3 text-right font-mono text-xs ${leader === "p1" ? "font-bold text-accent" : ""}`}
                          >
                            {fmt(v1 as number | null)}
                          </td>
                          <td className="py-2 px-3 text-center text-xs font-medium text-muted uppercase tracking-wider">
                            {label}
                          </td>
                          <td
                            className={`py-2 px-3 text-left font-mono text-xs ${leader === "p2" ? "font-bold text-accent" : ""}`}
                          >
                            {fmt(v2 as number | null)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {!loading && !data && player1 && player2 && (
        <p className="text-muted text-sm">No comparison data available.</p>
      )}
    </div>
  );
}
