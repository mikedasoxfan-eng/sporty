// Number formatting utilities for stat display

export function fmt(value: number | null | undefined, decimals: number = 3): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals);
}

export function fmtAvg(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  // Baseball averages: show .300 not 0.300
  const str = value.toFixed(3);
  return str.startsWith("0") ? str.slice(1) : str;
}

export function fmtEra(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(2);
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return (value * 100).toFixed(1) + "%";
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Math.round(value).toLocaleString();
}

export function fmtSalary(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function fmtIP(ipouts: number | null | undefined): string {
  if (ipouts === null || ipouts === undefined) return "—";
  const full = Math.floor(ipouts / 3);
  const partial = ipouts % 3;
  return `${full}.${partial}`;
}

export function fmtHeight(inches: number | null | undefined): string {
  if (inches === null || inches === undefined) return "—";
  const feet = Math.floor(inches / 12);
  const remain = inches % 12;
  return `${feet}'${remain}"`;
}

export function fmtRecord(w: number, l: number): string {
  return `${w}-${l}`;
}

export function fmtWinPct(w: number, l: number): string {
  if (w + l === 0) return "—";
  return (w / (w + l)).toFixed(3).slice(1);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ");
}

export function teamYear(teamID: string, year: number): string {
  return `${teamID} ${year}`;
}
