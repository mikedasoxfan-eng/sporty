// Team colors for circular jersey badges
const TEAM_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  NYY: { bg: "#1c2841", text: "#ffffff", ring: "#1c2841" },
  NYA: { bg: "#1c2841", text: "#ffffff", ring: "#1c2841" },
  NYM: { bg: "#002d72", text: "#ff5910", ring: "#002d72" },
  NYN: { bg: "#002d72", text: "#ff5910", ring: "#002d72" },
  BOS: { bg: "#ffffff", text: "#bd3039", ring: "#0c2340" },
  LAD: { bg: "#ffffff", text: "#005a9c", ring: "#005a9c" },
  LAN: { bg: "#ffffff", text: "#005a9c", ring: "#005a9c" },
  CHC: { bg: "#ffffff", text: "#0e3386", ring: "#cc3433" },
  CHN: { bg: "#ffffff", text: "#0e3386", ring: "#cc3433" },
  CWS: { bg: "#27251f", text: "#ffffff", ring: "#27251f" },
  CHA: { bg: "#27251f", text: "#ffffff", ring: "#27251f" },
  SFN: { bg: "#27251f", text: "#fd5a1e", ring: "#fd5a1e" },
  SF:  { bg: "#27251f", text: "#fd5a1e", ring: "#fd5a1e" },
  STL: { bg: "#ffffff", text: "#c41e3a", ring: "#0c2340" },
  SLN: { bg: "#ffffff", text: "#c41e3a", ring: "#0c2340" },
  ATL: { bg: "#13274f", text: "#ce1141", ring: "#ce1141" },
  HOU: { bg: "#002d62", text: "#eb6e1f", ring: "#002d62" },
  PHI: { bg: "#ffffff", text: "#e81828", ring: "#002d72" },
  DET: { bg: "#ffffff", text: "#0c2340", ring: "#0c2340" },
  CLE: { bg: "#00385d", text: "#ffffff", ring: "#e50022" },
  MIL: { bg: "#12284b", text: "#ffc52f", ring: "#12284b" },
  CIN: { bg: "#ffffff", text: "#c6011f", ring: "#c6011f" },
  PIT: { bg: "#fdb827", text: "#27251f", ring: "#27251f" },
  MIN: { bg: "#002b5c", text: "#d31145", ring: "#d31145" },
  KCA: { bg: "#004687", text: "#ffffff", ring: "#004687" },
  KC:  { bg: "#004687", text: "#ffffff", ring: "#004687" },
  SEA: { bg: "#0c2c56", text: "#005c5c", ring: "#005c5c" },
  ANA: { bg: "#ffffff", text: "#ba0021", ring: "#ba0021" },
  LAA: { bg: "#ffffff", text: "#ba0021", ring: "#ba0021" },
  OAK: { bg: "#003831", text: "#efb21e", ring: "#efb21e" },
  TEX: { bg: "#003278", text: "#ffffff", ring: "#c0111f" },
  TBA: { bg: "#092c5c", text: "#8fbce6", ring: "#8fbce6" },
  TB:  { bg: "#092c5c", text: "#8fbce6", ring: "#8fbce6" },
  TOR: { bg: "#134a8e", text: "#ffffff", ring: "#e8291c" },
  BAL: { bg: "#df4601", text: "#27251f", ring: "#27251f" },
  WAS: { bg: "#ffffff", text: "#ab0003", ring: "#14225a" },
  WSN: { bg: "#ffffff", text: "#ab0003", ring: "#14225a" },
  COL: { bg: "#33006f", text: "#c4ced4", ring: "#c4ced4" },
  ARI: { bg: "#a71930", text: "#e3d4ad", ring: "#000000" },
  SDN: { bg: "#2f241d", text: "#ffc425", ring: "#ffc425" },
  SDP: { bg: "#2f241d", text: "#ffc425", ring: "#ffc425" },
  SD:  { bg: "#2f241d", text: "#ffc425", ring: "#ffc425" },
  MIA: { bg: "#ffffff", text: "#00a3e0", ring: "#ef3340" },
  FLO: { bg: "#ffffff", text: "#00a3e0", ring: "#009ca6" },
  MON: { bg: "#ffffff", text: "#003087", ring: "#e4002b" },
};

const DEFAULT_COLORS = { bg: "#ffffff", text: "#1a1a1a", ring: "#1a1a1a" };

interface JerseyNumberProps {
  number: string;
  teamAbbr?: string | null;
  size?: "sm" | "md";
  title?: string;
  className?: string;
}

/**
 * Circular jersey number badge with team colors.
 * White/colored center with a thick team-colored ring border.
 */
export function JerseyNumber({
  number,
  teamAbbr,
  size = "sm",
  title,
  className = "",
}: JerseyNumberProps) {
  const colors = (teamAbbr && TEAM_COLORS[teamAbbr]) || DEFAULT_COLORS;

  const s = size === "md"
    ? "w-10 h-10 text-base border-[3px]"
    : "w-8 h-8 text-xs border-[2.5px]";

  return (
    <div
      className={`${s} rounded-full flex items-center justify-center
        font-mono font-bold shrink-0 ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.ring,
      }}
      title={title}
    >
      {number}
    </div>
  );
}

export interface JerseyHistoryEntry {
  jerseyNumber: string;
  teamName: string | null;
  teamAbbr: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}
