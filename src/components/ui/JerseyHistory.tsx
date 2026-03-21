"use client";

import { JerseyNumber } from "./JerseyNumber";
import type { JerseyHistoryEntry } from "./JerseyNumber";

function formatYear(dateStr: string | null): string {
  if (!dateStr) return "?";
  return dateStr.slice(0, 4);
}

/**
 * Determine if a team abbreviation is an MLB team.
 * Instead of whitelisting 250+ historical abbreviations, we blacklist
 * known minor league patterns from the MLB Stats API rosterEntries.
 */
function isMLBTeam(abbr: string | null): boolean {
  if (!abbr) return true; // null = primaryNumber fallback, keep it
  // MLB Stats API prefixes minor league with league code + dash:
  // A- (Arizona/rookie), D- (Dominican), F- (Florida), G- (Gulf Coast),
  // V- (Venezuelan), R- (rookie)
  if (/^[A-Z]-/.test(abbr)) return false;
  // 3+ char lowercase-ish abbreviations that are clearly minor league cities
  // Minor league teams typically have 3-letter city codes not in MLB
  // Filter by known minor league organizations from the 473 we found:
  const MINOR_LEAGUE = new Set([
    "ABD","ABQ","ADE","AGS","AGU","AKL","AKR","ALT","AMA","ARA","ARE",
    "ARK","ASH","ATH","AUB","AUG","AZ","BAK","BAT","BC","BEL","BG",
    "BIL","BIR","BLU","BLX","BNG","BOI","BOW","BRD","BRI","BRK","BRS",
    "BRV","BUF","BUR","CAG","CAM","CAN","CAR","CAS","CC","CHE","CHI",
    "CHS","CLI","CLR","CLT","CON","COS","CR","CT","CUB","CUL","CW",
    "CWV","DAN","DAY","DBT","DE","DEL","DOM","DR","DR1","DUN","DUR",
    "ELP","ELZ","ERI","ESC","EST","EUG","EVE","FAY","FBG","FRE","FRI",
    "FTM","FW","GAS","GBO","GCR","GDD","GDL","GEE","GIG","GJ","GL",
    "GRF","GRN","GSV","GTF","GVL","GWN","HAG","HBG","HCS","HD","HEL",
    "HER","HFD","HIC","HIL","HON","HOW","HP","HV","HVL","IDF","IE",
    "IND","IOW","JAL","JAM","JAX","JC","JET","JON","JS","JUP","JXN",
    "KAN","KIN","KNG","KNX","LAG","LAK","LAR","LC","LE","LEO","LEX",
    "LHV","LI","LIC","LOU","LOW","LV","LWD","LYN","MAG","MAN","MAR",
    "MAY","MAZ","MB","MEL","MEM","MEX","MID","MIS","MOB","MOC","MOD",
    "MSS","MTG","MTY","MV","MVA","MXC","MXO","MXR","MXV","NAS","NAV",
    "NAY","NBR","NEW","NH","NO","NOR","NS","NWA","OAX","OBR","OGD",
    "OKC","OKL","OMA","ONE","ORI","ORM","OTT","PAN","PAW","PDD","PEJ",
    "PEO","PER","PES","PMB","PNS","PON","POR","POT","PRN","PUE","PUL",
    "PUR","QC","QRO","RC","RCT","REA","RIC","RMV","RNO","ROC","ROM",
    "RR","SA","SAC","SAL","SAN","SAR","SAV","SB","SC","SCO","SI","SJ",
    "SJU","SK","SL","SLT","SLU","SMD","SOM","SPO","SPR","SRR","STK",
    "STP","SUG","SUR","SWB","SWM","SYD","SYR","TAB","TAC","TAM","TBT",
    "TIG","TIJ","TNS","TOL","TRI","TRN","TUC","TUL","USA","VAN","VEN",
    "VER","VIS","WAI","WCH","WHG","WIC","WIL","WIS","WM","WO","WOR",
    "WS","WTN","WV","YAK","YOR","YUC","ZUL","RA12",
  ]);
  return !MINOR_LEAGUE.has(abbr);
}

function dedupeEntries(entries: JerseyHistoryEntry[]) {
  const grouped = new Map<
    string,
    { number: string; abbr: string | null; startYear: string; endYear: string; isActive: boolean }
  >();
  for (const e of entries) {
    if (!isMLBTeam(e.teamAbbr)) continue;
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
