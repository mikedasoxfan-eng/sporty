// Team-specific jersey styling: colors, pinstripes, font style
// Based on actual MLB uniform designs
const TEAM_STYLES: Record<string, {
  bg: string;
  text: string;
  border: string;
  outline?: string;
  pinstripes?: boolean;
  serif?: boolean;
}> = {
  NYY: { bg: "#1c2841", text: "#ffffff", border: "#1c2841", pinstripes: true, serif: true },
  NYM: { bg: "#002d72", text: "#ff5910", border: "#002d72", pinstripes: true },
  BOS: { bg: "#bd3039", text: "#ffffff", border: "#bd3039", serif: true },
  LAD: { bg: "#005a9c", text: "#ffffff", border: "#005a9c", serif: true },
  CHC: { bg: "#0e3386", text: "#cc3433", border: "#0e3386", pinstripes: true },
  CHA: { bg: "#27251f", text: "#ffffff", border: "#27251f", pinstripes: true },
  SFN: { bg: "#27251f", text: "#fd5a1e", border: "#27251f", serif: true },
  STL: { bg: "#c41e3a", text: "#ffffff", border: "#c41e3a", serif: true },
  ATL: { bg: "#13274f", text: "#ce1141", border: "#13274f" },
  HOU: { bg: "#002d62", text: "#eb6e1f", border: "#002d62" },
  PHI: { bg: "#e81828", text: "#ffffff", border: "#e81828", pinstripes: true },
  DET: { bg: "#0c2340", text: "#ffffff", border: "#0c2340", serif: true },
  CLE: { bg: "#00385d", text: "#e50022", border: "#00385d" },
  MIL: { bg: "#12284b", text: "#ffc52f", border: "#12284b" },
  CIN: { bg: "#c6011f", text: "#ffffff", border: "#c6011f" },
  PIT: { bg: "#27251f", text: "#fdb827", border: "#27251f" },
  MIN: { bg: "#002b5c", text: "#d31145", border: "#002b5c", pinstripes: true },
  KCA: { bg: "#004687", text: "#ffffff", border: "#004687" },
  SEA: { bg: "#0c2c56", text: "#005c5c", border: "#0c2c56" },
  ANA: { bg: "#ba0021", text: "#ffffff", border: "#ba0021" },
  LAA: { bg: "#ba0021", text: "#ffffff", border: "#ba0021" },
  OAK: { bg: "#003831", text: "#efb21e", border: "#003831" },
  TEX: { bg: "#003278", text: "#c0111f", border: "#003278" },
  TBA: { bg: "#092c5c", text: "#8fbce6", border: "#092c5c" },
  TOR: { bg: "#134a8e", text: "#ffffff", border: "#134a8e" },
  BAL: { bg: "#df4601", text: "#27251f", border: "#df4601" },
  WAS: { bg: "#ab0003", text: "#ffffff", border: "#ab0003" },
  WSN: { bg: "#ab0003", text: "#ffffff", border: "#ab0003" },
  COL: { bg: "#33006f", text: "#c4ced4", border: "#33006f" },
  ARI: { bg: "#a71930", text: "#e3d4ad", border: "#a71930" },
  SDN: { bg: "#2f241d", text: "#ffc425", border: "#2f241d" },
  SDP: { bg: "#2f241d", text: "#ffc425", border: "#2f241d" },
  MIA: { bg: "#00a3e0", text: "#ef3340", border: "#00a3e0" },
  FLO: { bg: "#00a3e0", text: "#ef3340", border: "#00a3e0" },
  MON: { bg: "#003087", text: "#e4002b", border: "#003087" },
};

const DEFAULT_STYLE: typeof TEAM_STYLES[string] = { bg: "#1a1a1a", text: "#ffffff", border: "#1a1a1a" };

interface JerseyNumberProps {
  number: string;
  teamAbbr?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function JerseyNumber({ number, teamAbbr, size = "md", className = "" }: JerseyNumberProps) {
  const style = (teamAbbr && TEAM_STYLES[teamAbbr]) || DEFAULT_STYLE;
  const hasPinstripes = "pinstripes" in style && style.pinstripes;

  const sizes = {
    sm: { box: "w-9 h-9", text: "text-base" },
    md: { box: "w-12 h-14", text: "text-xl" },
    lg: { box: "w-16 h-20", text: "text-3xl" },
  };

  return (
    <div
      className={`${sizes[size].box} rounded-md flex items-center justify-center
        font-bold relative overflow-hidden ${className}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderWidth: "2px",
        borderColor: style.border,
        fontFamily: style.serif
          ? "'Georgia', 'Times New Roman', serif"
          : "'Geist Mono', 'Courier New', monospace",
        textShadow: style.outline
          ? `1px 1px 0 ${style.outline}, -1px -1px 0 ${style.outline}, 1px -1px 0 ${style.outline}, -1px 1px 0 ${style.outline}`
          : "none",
      }}
    >
      {/* Pinstripes */}
      {hasPinstripes && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 3px, ${style.text} 3px, ${style.text} 3.5px)`,
          }}
        />
      )}
      {/* Fabric texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, currentColor 1px, currentColor 1.5px)",
        }}
      />
      <span className={`${sizes[size].text} relative z-10`}>{number}</span>
    </div>
  );
}

interface JerseyHistoryEntry {
  jerseyNumber: string;
  teamName: string | null;
  teamAbbr: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

interface JerseyHistoryProps {
  entries: JerseyHistoryEntry[];
}

function formatYear(dateStr: string | null): string {
  if (!dateStr) return "?";
  return dateStr.slice(0, 4);
}

export function JerseyHistory({ entries }: JerseyHistoryProps) {
  if (entries.length === 0) return null;

  // Deduplicate: group by number + team
  const grouped = new Map<
    string,
    {
      number: string;
      team: string | null;
      abbr: string | null;
      startYear: string;
      endYear: string;
      isActive: boolean;
    }
  >();

  for (const e of entries) {
    const key = `${e.jerseyNumber}-${e.teamAbbr || "?"}`;
    const existing = grouped.get(key);
    const startYear = formatYear(e.startDate);
    const endYear = e.isActive ? "present" : formatYear(e.endDate);

    if (existing) {
      if (startYear < existing.startYear) existing.startYear = startYear;
      if (endYear > existing.endYear || endYear === "present")
        existing.endYear = endYear;
      if (e.isActive) existing.isActive = true;
    } else {
      grouped.set(key, {
        number: e.jerseyNumber,
        team: e.teamName,
        abbr: e.teamAbbr,
        startYear,
        endYear,
        isActive: e.isActive,
      });
    }
  }

  const items = Array.from(grouped.values()).sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return b.startYear.localeCompare(a.startYear);
  });

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold tracking-tight mb-4">
        Uniform Numbers
      </h2>
      <div className="flex flex-wrap gap-4">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-surface hover:bg-surface-alt transition-colors"
          >
            <JerseyNumber
              number={item.number}
              teamAbbr={item.abbr}
              size="md"
            />
            <div>
              <p className="text-sm font-medium">
                {item.team || item.abbr || "Unknown"}
              </p>
              <p className="text-xs text-muted font-mono">
                {item.startYear}
                {item.endYear && item.startYear !== item.endYear
                  ? `\u2013${item.endYear}`
                  : ""}
              </p>
              {item.isActive && (
                <span className="text-[10px] text-accent font-medium uppercase tracking-wider">
                  Current
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
