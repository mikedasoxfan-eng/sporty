// Batting stat calculations

export function battingAvg(h: number, ab: number): number | null {
  if (ab === 0) return null;
  return h / ab;
}

export function onBasePct(
  h: number,
  bb: number,
  hbp: number,
  ab: number,
  sf: number
): number | null {
  const denom = ab + bb + hbp + sf;
  if (denom === 0) return null;
  return (h + bb + hbp) / denom;
}

export function sluggingPct(
  h: number,
  doubles: number,
  triples: number,
  hr: number,
  ab: number
): number | null {
  if (ab === 0) return null;
  const singles = h - doubles - triples - hr;
  const tb = singles + 2 * doubles + 3 * triples + 4 * hr;
  return tb / ab;
}

export function ops(obp: number | null, slg: number | null): number | null {
  if (obp === null || slg === null) return null;
  return obp + slg;
}

export function totalBases(
  h: number,
  doubles: number,
  triples: number,
  hr: number
): number {
  const singles = h - doubles - triples - hr;
  return singles + 2 * doubles + 3 * triples + 4 * hr;
}

export function inningsPitched(ipouts: number): number {
  return Math.floor(ipouts / 3) + (ipouts % 3) / 10;
}

export function inningsPitchedDisplay(ipouts: number): string {
  const full = Math.floor(ipouts / 3);
  const partial = ipouts % 3;
  return partial === 0 ? `${full}.0` : `${full}.${partial}`;
}

export function era(er: number, ipouts: number): number | null {
  if (ipouts === 0) return null;
  return (er * 27) / ipouts;
}

export function whip(
  bb: number,
  h: number,
  ipouts: number
): number | null {
  if (ipouts === 0) return null;
  return ((bb + h) * 3) / ipouts;
}

export function fip(
  hr: number,
  bb: number,
  hbp: number,
  so: number,
  ipouts: number,
  leagueFIPConstant: number = 3.2
): number | null {
  if (ipouts === 0) return null;
  const ip = ipouts / 3;
  return ((13 * hr + 3 * (bb + (hbp || 0)) - 2 * so) / ip) + leagueFIPConstant;
}

export function fieldingPct(
  po: number,
  a: number,
  e: number
): number | null {
  const ch = po + a + e;
  if (ch === 0) return null;
  return (po + a) / ch;
}

export function babip(
  h: number,
  hr: number,
  ab: number,
  so: number,
  sf: number
): number | null {
  const denom = ab - so - hr + (sf || 0);
  if (denom <= 0) return null;
  return (h - hr) / denom;
}

export function iso(
  doubles: number,
  triples: number,
  hr: number,
  ab: number
): number | null {
  if (ab === 0) return null;
  return (doubles + 2 * triples + 3 * hr) / ab;
}

// Pythagorean win expectation
export function pythagoreanWinPct(
  runsScored: number,
  runsAllowed: number,
  exponent: number = 1.83
): number | null {
  if (runsScored + runsAllowed === 0) return null;
  const rs = Math.pow(runsScored, exponent);
  const ra = Math.pow(runsAllowed, exponent);
  return rs / (rs + ra);
}

// Strikeout rate
export function kPct(so: number, pa: number): number | null {
  if (pa === 0) return null;
  return so / pa;
}

// Walk rate
export function bbPct(bb: number, pa: number): number | null {
  if (pa === 0) return null;
  return bb / pa;
}

// K/BB ratio
export function kbb(so: number, bb: number): number | null {
  if (bb === 0) return null;
  return so / bb;
}

// Plate appearances from batting line
export function plateAppearances(
  ab: number,
  bb: number,
  hbp: number,
  sh: number,
  sf: number
): number {
  return ab + bb + (hbp || 0) + (sh || 0) + (sf || 0);
}

// Per-nine rates for pitching
export function perNine(
  stat: number,
  ipouts: number
): number | null {
  if (ipouts === 0) return null;
  return (stat * 27) / ipouts;
}
