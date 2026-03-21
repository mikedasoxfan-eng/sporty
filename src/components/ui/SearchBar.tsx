"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";

interface SearchResult {
  playerID: string;
  nameFirst: string;
  nameLast: string;
  debut: string | null;
  finalGame: string | null;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.players || []);
          setOpen(true);
        }
      } catch {
        // Aborted or failed
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      navigateToPlayer(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function navigateToPlayer(player: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(`/baseball/players/${player.playerID}`);
  }

  function yearRange(debut: string | null, finalGame: string | null): string {
    const start = debut?.slice(0, 4) || "?";
    const end = finalGame?.slice(0, 4) || "present";
    return `${start}–${end}`;
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MagnifyingGlass
          size={16}
          weight="regular"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-light"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search players..."
          className="w-full h-9 pl-9 pr-3 text-sm bg-surface-alt border border-border rounded-lg
                     placeholder:text-muted-light focus:outline-none focus:ring-1 focus:ring-accent/30
                     focus:border-accent/50 transition-all"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-lg shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden z-50">
          {results.map((player, i) => (
            <button
              key={player.playerID}
              onClick={() => navigateToPlayer(player)}
              className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-sm
                         transition-colors ${
                           i === activeIndex
                             ? "bg-surface-alt"
                             : "hover:bg-surface-alt"
                         }`}
            >
              <span className="font-medium">
                {player.nameFirst} {player.nameLast}
              </span>
              <span className="text-xs text-muted font-mono">
                {yearRange(player.debut, player.finalGame)}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-lg shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden z-50 p-4">
          <p className="text-sm text-muted text-center">No players found</p>
        </div>
      )}
    </div>
  );
}
