import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtInt } from "@/lib/format";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const TH_LEFT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left";
const TH_RIGHT =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-right";
const TD_RIGHT = "py-2 px-2.5 text-right font-mono text-xs";
const TD_RIGHT_BOLD = "py-2 px-2.5 text-right font-mono text-xs font-medium";
const LINK_CLASSES =
  "text-link hover:text-link-hover hover:underline transition-colors";
const STICKY_TH =
  "py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap text-left sticky left-0 z-20 bg-surface";
const STICKY_TD =
  "py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface whitespace-nowrap";

function passerRating(
  comp: number,
  att: number,
  yds: number,
  td: number,
  int_: number
): number | null {
  if (att === 0) return null;
  const a = Math.max(0, Math.min((comp / att - 0.3) * 5, 2.375));
  const b = Math.max(0, Math.min((yds / att - 3) * 0.25, 2.375));
  const c = Math.max(0, Math.min((td / att) * 20, 2.375));
  const d = Math.max(0, Math.min(2.375 - (int_ / att) * 25, 2.375));
  return ((a + b + c + d) / 6) * 100;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  params: Promise<{ year: string; category: string }>;
}

const VALID_CATEGORIES = ["passing", "rushing", "receiving"];

const categoryLabels: Record<string, string> = {
  passing: "Passing Leaders",
  rushing: "Rushing Leaders",
  receiving: "Receiving Leaders",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, category } = await params;
  if (!VALID_CATEGORIES.includes(category)) return { title: "Not Found" };
  return { title: `${year} NFL ${categoryLabels[category]}` };
}

async function getLeaderData(year: number, category: string) {
  if (!VALID_CATEGORIES.includes(category)) return null;

  // Set minimum qualifiers
  const where: Record<string, unknown> = {
    season: year,
    seasonType: "REG",
  };

  let orderBy: Record<string, string> = {};

  if (category === "passing") {
    where.passAttempts = { gte: 50 };
    orderBy = { passYards: "desc" };
  } else if (category === "rushing") {
    where.carries = { gte: 20 };
    orderBy = { rushYards: "desc" };
  } else {
    where.targets = { gte: 15 };
    orderBy = { recYards: "desc" };
  }

  const stats = await prisma.nFLPlayerStats.findMany({
    where,
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          position: true,
        },
      },
    },
    orderBy,
    take: 100,
  });

  return stats;
}

export default async function NFLLeadersPage({ params }: Props) {
  const { year: yearStr, category } = await params;
  const year = parseInt(yearStr);

  if (!VALID_CATEGORIES.includes(category)) notFound();

  const stats = await getLeaderData(year, category);

  if (!stats) notFound();

  const label = categoryLabels[category];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/football"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Football
          </Link>
          <span className="text-xs text-muted-light">/</span>
          <Link
            href={`/football/seasons/${year}`}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            {year}
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {year} <span className="text-muted">{label}</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-3">
          {VALID_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/football/seasons/${year}/${cat}`}
              className={`text-sm px-3 py-1.5 border rounded-md transition-colors ${
                cat === category
                  ? "border-accent bg-accent/5 text-accent"
                  : "border-border hover:bg-surface-alt text-muted hover:text-foreground"
              }`}
            >
              {categoryLabels[cat]}
            </Link>
          ))}
        </div>
      </div>

      {/* Stats Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <div className="stat-scroll overflow-x-auto">
          {category === "passing" && (
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider text-center w-8">
                    #
                  </th>
                  <th className={STICKY_TH}>Player</th>
                  {["Team", "Pos", "G", "Comp", "Att", "Pct", "Yds", "TD", "INT", "Sacks", "Rating"].map(
                    (col) => (
                      <th
                        key={col}
                        className={
                          col === "Team" || col === "Pos" ? TH_LEFT : TH_RIGHT
                        }
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {stats.map((s, i) => {
                  const cmp = s.completions || 0;
                  const att = s.passAttempts || 0;
                  const pct =
                    att > 0 ? ((cmp / att) * 100).toFixed(1) : "\u2014";
                  const rating = passerRating(
                    cmp,
                    att,
                    s.passYards || 0,
                    s.passTds || 0,
                    s.interceptions || 0
                  );
                  return (
                    <tr key={s.id}>
                      <td className="py-2 px-2.5 text-center text-xs text-muted">
                        {i + 1}
                      </td>
                      <td className={STICKY_TD}>
                        <Link
                          href={`/football/players/${s.player.id}`}
                          className={LINK_CLASSES}
                        >
                          {s.player.displayName ||
                            `${s.player.firstName} ${s.player.lastName}`}
                        </Link>
                      </td>
                      <td className="py-2 px-2.5 text-left text-xs">
                        {s.team ? (
                          <Link
                            href={`/football/teams/${s.team}/${year}`}
                            className={LINK_CLASSES}
                          >
                            {s.team}
                          </Link>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-left text-xs text-muted">
                        {s.player.position || s.position || "\u2014"}
                      </td>
                      <td className={TD_RIGHT}>{s.games || 0}</td>
                      <td className={TD_RIGHT}>{cmp}</td>
                      <td className={TD_RIGHT}>{att}</td>
                      <td className={TD_RIGHT}>{pct}</td>
                      <td className={TD_RIGHT_BOLD}>
                        {fmtInt(s.passYards || 0)}
                      </td>
                      <td className={TD_RIGHT_BOLD}>{s.passTds || 0}</td>
                      <td className={TD_RIGHT}>{s.interceptions || 0}</td>
                      <td className={TD_RIGHT}>{s.sacks || 0}</td>
                      <td className={TD_RIGHT_BOLD}>
                        {rating !== null ? rating.toFixed(1) : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {category === "rushing" && (
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider text-center w-8">
                    #
                  </th>
                  <th className={STICKY_TH}>Player</th>
                  {["Team", "Pos", "G", "Car", "Yds", "Y/A", "TD", "Fum", "FumL"].map(
                    (col) => (
                      <th
                        key={col}
                        className={
                          col === "Team" || col === "Pos" ? TH_LEFT : TH_RIGHT
                        }
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {stats.map((s, i) => {
                  const car = s.carries || 0;
                  const yds = s.rushYards || 0;
                  const ya = car > 0 ? (yds / car).toFixed(1) : "\u2014";
                  return (
                    <tr key={s.id}>
                      <td className="py-2 px-2.5 text-center text-xs text-muted">
                        {i + 1}
                      </td>
                      <td className={STICKY_TD}>
                        <Link
                          href={`/football/players/${s.player.id}`}
                          className={LINK_CLASSES}
                        >
                          {s.player.displayName ||
                            `${s.player.firstName} ${s.player.lastName}`}
                        </Link>
                      </td>
                      <td className="py-2 px-2.5 text-left text-xs">
                        {s.team ? (
                          <Link
                            href={`/football/teams/${s.team}/${year}`}
                            className={LINK_CLASSES}
                          >
                            {s.team}
                          </Link>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-left text-xs text-muted">
                        {s.player.position || s.position || "\u2014"}
                      </td>
                      <td className={TD_RIGHT}>{s.games || 0}</td>
                      <td className={TD_RIGHT}>{car}</td>
                      <td className={TD_RIGHT_BOLD}>{fmtInt(yds)}</td>
                      <td className={TD_RIGHT}>{ya}</td>
                      <td className={TD_RIGHT_BOLD}>{s.rushTds || 0}</td>
                      <td className={TD_RIGHT}>{s.fumbles || 0}</td>
                      <td className={TD_RIGHT}>{s.fumblesLost || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {category === "receiving" && (
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider text-center w-8">
                    #
                  </th>
                  <th className={STICKY_TH}>Player</th>
                  {["Team", "Pos", "G", "Tgt", "Rec", "Yds", "Y/R", "TD"].map(
                    (col) => (
                      <th
                        key={col}
                        className={
                          col === "Team" || col === "Pos" ? TH_LEFT : TH_RIGHT
                        }
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {stats.map((s, i) => {
                  const rec = s.receptions || 0;
                  const yds = s.recYards || 0;
                  const yr = rec > 0 ? (yds / rec).toFixed(1) : "\u2014";
                  return (
                    <tr key={s.id}>
                      <td className="py-2 px-2.5 text-center text-xs text-muted">
                        {i + 1}
                      </td>
                      <td className={STICKY_TD}>
                        <Link
                          href={`/football/players/${s.player.id}`}
                          className={LINK_CLASSES}
                        >
                          {s.player.displayName ||
                            `${s.player.firstName} ${s.player.lastName}`}
                        </Link>
                      </td>
                      <td className="py-2 px-2.5 text-left text-xs">
                        {s.team ? (
                          <Link
                            href={`/football/teams/${s.team}/${year}`}
                            className={LINK_CLASSES}
                          >
                            {s.team}
                          </Link>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-left text-xs text-muted">
                        {s.player.position || s.position || "\u2014"}
                      </td>
                      <td className={TD_RIGHT}>{s.games || 0}</td>
                      <td className={TD_RIGHT}>{s.targets || 0}</td>
                      <td className={TD_RIGHT_BOLD}>{rec}</td>
                      <td className={TD_RIGHT_BOLD}>{fmtInt(yds)}</td>
                      <td className={TD_RIGHT}>{yr}</td>
                      <td className={TD_RIGHT_BOLD}>{s.recTds || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {stats.length === 0 && (
        <div className="border border-border rounded-lg bg-surface p-8 text-center mt-4">
          <p className="text-muted">
            No {category} data available for the {year} season.
          </p>
        </div>
      )}
    </div>
  );
}
