"use client";

import { JerseyNumber } from "./JerseyNumber";
import type { JerseyHistoryEntry } from "./JerseyNumber";

function formatYear(dateStr: string | null): string {
  if (!dateStr) return "?";
  return dateStr.slice(0, 4);
}

// MLB team abbreviations only — all current + historical franchises
// Uses the abbreviations the MLB Stats API returns
const MLB_TEAMS = new Set([
  // Current 30 teams (API abbreviations)
  "ARI","ATL","BAL","BOS","CHC","CIN","CLE","COL","CWS","DET",
  "HOU","KC","LAA","LAD","MIA","MIL","MIN","NYM","NYY","OAK",
  "PHI","PIT","SD","SEA","SF","STL","TB","TEX","TOR","WSH",
  // Historical / alternate abbreviations
  "ANA","CHA","CHN","FLA","FLO","KCA","LAN","MON","NYA","NYN",
  "SDN","SFN","SLN","TBA","WAS","WSN",
]);

function dedupeEntries(entries: JerseyHistoryEntry[]) {
  const grouped = new Map<
    string,
    { number: string; abbr: string | null; startYear: string; endYear: string; isActive: boolean }
  >();
  for (const e of entries) {
    // Skip non-MLB teams (keep null abbr entries — those are primaryNumber fallbacks)
    if (e.teamAbbr && !MLB_TEAMS.has(e.teamAbbr)) continue;
    // Skip entries from DSL, AZL, GCL, FCL, ACL and other minor league prefixes
    if (e.teamAbbr && /^[A-Z]-/.test(e.teamAbbr)) continue;
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
    <div className="mb-2 flex items-center gap-1.5">
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
