"use client";

import { JerseyNumber } from "./JerseyNumber";
import type { JerseyHistoryEntry } from "./JerseyNumber";

function formatYear(dateStr: string | null): string {
  if (!dateStr) return "?";
  return dateStr.slice(0, 4);
}

// Only MLB team abbreviations (no minor league)
const MLB_TEAMS = new Set([
  "ANA","ARI","ATL","BAL","BOS","CHA","CHN","CIN","CLE","COL",
  "DET","FLO","HOU","KCA","LAA","LAN","MIA","MIL","MIN","MON",
  "NYA","NYN","OAK","PHI","PIT","SDN","SEA","SFN","SLN","TBA",
  "TEX","TOR","WAS","WSN","SDP","LAD","NYY","NYM","CHC","CWS",
  "STL","SF","TB","KC","SD",
]);

function dedupeEntries(entries: JerseyHistoryEntry[]) {
  const grouped = new Map<
    string,
    { number: string; abbr: string | null; startYear: string; endYear: string; isActive: boolean }
  >();
  for (const e of entries) {
    // Skip non-MLB teams
    if (e.teamAbbr && !MLB_TEAMS.has(e.teamAbbr)) continue;
    const key = `${e.jerseyNumber}-${e.teamAbbr || "?"}`;
    const existing = grouped.get(key);
    const startYear = formatYear(e.startDate);
    const endYear = e.isActive ? "present" : formatYear(e.endDate);
    if (existing) {
      if (startYear < existing.startYear) existing.startYear = startYear;
      if (endYear > existing.endYear || endYear === "present") existing.endYear = endYear;
      if (e.isActive) existing.isActive = true;
    } else {
      grouped.set(key, { number: e.jerseyNumber, abbr: e.teamAbbr, startYear, endYear, isActive: e.isActive });
    }
  }
  return Array.from(grouped.values()).sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return b.startYear.localeCompare(a.startYear);
  });
}

interface Props {
  entries: JerseyHistoryEntry[];
}

export function JerseyHistory({ entries }: Props) {
  if (entries.length === 0) return null;
  const items = dedupeEntries(entries);
  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-1.5">
      {items.map((item, i) => {
        const years = item.startYear + (item.endYear && item.startYear !== item.endYear ? `\u2013${item.endYear}` : "");
        const tooltip = `#${item.number} \u2014 ${item.abbr || "?"} (${years})`;
        return (
          <JerseyNumber
            key={i}
            number={item.number}
            teamAbbr={item.abbr}
            title={tooltip}
          />
        );
      })}
    </div>
  );
}
