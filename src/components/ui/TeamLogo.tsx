// Lahman teamID -> MLB API team ID mapping
const TEAM_MLB_ID: Record<string, number> = {
  // Current teams (Lahman ID -> MLB team ID)
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHA: 145, CHN: 112,
  CIN: 113, CLE: 114, COL: 115, DET: 116, HOU: 117, KCA: 118,
  LAA: 108, LAN: 119, MIA: 146, MIL: 158, MIN: 142, NYA: 147,
  NYN: 121, OAK: 133, PHI: 143, PIT: 134, SDN: 135, SEA: 136,
  SFN: 137, SLN: 138, TBA: 139, TEX: 140, TOR: 141, WAS: 120,
  // Alternate abbreviations
  ANA: 108, FLO: 146, MON: 120, WSN: 120,
  // Common display abbreviations
  NYY: 147, NYM: 121, CHC: 112, CWS: 145, LAD: 119, SF: 137,
  STL: 138, TB: 139, KC: 118, SD: 135,
};

interface TeamLogoProps {
  teamID: string;
  size?: number;
  className?: string;
}

export function TeamLogo({ teamID, size = 24, className = "" }: TeamLogoProps) {
  const mlbId = TEAM_MLB_ID[teamID];
  if (!mlbId) return null;

  return (
    <img
      src={`https://www.mlbstatic.com/team-logos/${mlbId}.svg`}
      alt={teamID}
      width={size}
      height={size}
      className={`inline-block ${className}`}
      loading="lazy"
    />
  );
}
