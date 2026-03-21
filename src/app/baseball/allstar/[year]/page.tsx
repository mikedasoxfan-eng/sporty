import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fullName } from "@/lib/format";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ year: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `${year} All-Star Game` };
}

const positionNames: Record<number, string> = {
  1: "P",
  2: "C",
  3: "1B",
  4: "2B",
  5: "3B",
  6: "SS",
  7: "LF",
  8: "CF",
  9: "RF",
  10: "DH",
};

async function getData(year: number) {
  const entries = await prisma.allstarFull.findMany({
    where: { yearID: year },
    include: {
      player: {
        select: { nameFirst: true, nameLast: true, nameGiven: true, nameSuffix: true },
      },
    },
    orderBy: [{ lgID: "asc" }, { startingPos: "asc" }],
  });

  if (entries.length === 0) return null;

  return { entries };
}

export default async function AllStarYearPage({ params }: Props) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr);
  const data = await getData(year);

  if (!data) notFound();

  const { entries } = data;

  // Group by league
  const leagues = new Map<string, typeof entries>();
  for (const e of entries) {
    const lg = e.lgID || "Unknown";
    if (!leagues.has(lg)) leagues.set(lg, []);
    leagues.get(lg)!.push(e);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/baseball"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Baseball
          </Link>
          <span className="text-xs text-muted-light">/</span>
          <Link
            href="/baseball/allstar"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            All-Star
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {year} <span className="text-muted">All-Star Game</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/baseball/allstar/${year - 1}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
          >
            {year - 1}
          </Link>
          <Link
            href={`/baseball/allstar/${year + 1}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors text-muted"
          >
            {year + 1}
          </Link>
        </div>
      </div>

      {/* Rosters by league */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Array.from(leagues.entries()).map(([lg, players]) => {
          // Separate starters from reserves
          const starters = players.filter((p) => p.startingPos && p.startingPos > 0);
          const reserves = players.filter((p) => !p.startingPos || p.startingPos === 0);

          return (
            <div key={lg}>
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
                {lg === "AL" ? "American League" : lg === "NL" ? "National League" : lg}
              </h2>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-left">
                          Player
                        </th>
                        <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-left">
                          Team
                        </th>
                        <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-center">
                          Pos
                        </th>
                        <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-center">
                          GP
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {starters.length > 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-1.5 px-3 text-xs font-medium text-muted uppercase tracking-wider bg-surface-alt"
                          >
                            Starters
                          </td>
                        </tr>
                      )}
                      {starters.map((p) => (
                        <tr key={`${p.playerID}-${p.gameNum}`}>
                          <td className="py-2 px-3 text-left">
                            <Link
                              href={`/baseball/players/${p.playerID}`}
                              className="text-link hover:text-link-hover hover:underline transition-colors"
                            >
                              {fullName(p.player.nameFirst, p.player.nameLast, p.player.nameGiven, p.player.nameSuffix)}
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-left text-xs text-muted font-mono">
                            {p.teamID || "—"}
                          </td>
                          <td className="py-2 px-3 text-center text-xs font-mono">
                            {p.startingPos ? positionNames[p.startingPos] || p.startingPos : "—"}
                          </td>
                          <td className="py-2 px-3 text-center text-xs font-mono">
                            {p.GP === 1 ? "Y" : "—"}
                          </td>
                        </tr>
                      ))}
                      {reserves.length > 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-1.5 px-3 text-xs font-medium text-muted uppercase tracking-wider bg-surface-alt"
                          >
                            Reserves
                          </td>
                        </tr>
                      )}
                      {reserves.map((p) => (
                        <tr key={`${p.playerID}-${p.gameNum}-r`}>
                          <td className="py-2 px-3 text-left">
                            <Link
                              href={`/baseball/players/${p.playerID}`}
                              className="text-link hover:text-link-hover hover:underline transition-colors"
                            >
                              {fullName(p.player.nameFirst, p.player.nameLast, p.player.nameGiven, p.player.nameSuffix)}
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-left text-xs text-muted font-mono">
                            {p.teamID || "—"}
                          </td>
                          <td className="py-2 px-3 text-center text-xs font-mono">
                            —
                          </td>
                          <td className="py-2 px-3 text-center text-xs font-mono">
                            {p.GP === 1 ? "Y" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
