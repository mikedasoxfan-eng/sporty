import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fullName, fmtAvg } from "@/lib/format";
import { fieldingPct } from "@/lib/stats";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ year: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `${year} Fielding Leaders` };
}

const POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
const TOP_N = 10;

async function getData(year: number) {
  const fielding = await prisma.fielding.findMany({
    where: {
      yearID: year,
      POS: { in: [...POSITIONS] },
    },
    include: {
      player: {
        select: { nameFirst: true, nameLast: true, nameGiven: true, nameSuffix: true },
      },
    },
    orderBy: [{ G: "desc" }],
  });

  if (fielding.length === 0) return null;

  // Group by position, then take top N by games
  const byPosition = new Map<string, typeof fielding>();
  for (const pos of POSITIONS) {
    byPosition.set(pos, []);
  }

  for (const f of fielding) {
    const posGroup = byPosition.get(f.POS);
    if (posGroup && posGroup.length < TOP_N) {
      posGroup.push(f);
    }
  }

  return { byPosition };
}

export default async function FieldingLeadersPage({ params }: Props) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr);
  const data = await getData(year);

  if (!data) notFound();

  const { byPosition } = data;

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
            href={`/baseball/seasons/${year}`}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            {year}
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {year} <span className="text-muted">Fielding Leaders</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/baseball/seasons/${year}`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Season Overview
          </Link>
          <Link
            href={`/baseball/seasons/${year}/batting`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Batting
          </Link>
          <Link
            href={`/baseball/seasons/${year}/pitching`}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Pitching
          </Link>
        </div>
      </div>

      {/* Fielding tables by position */}
      <div className="space-y-10">
        {POSITIONS.map((pos) => {
          const players = byPosition.get(pos);
          if (!players || players.length === 0) return null;

          return (
            <section key={pos}>
              <h2 className="text-lg font-semibold tracking-tight mb-4">
                {pos}
              </h2>
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <div className="stat-scroll overflow-x-auto">
                  <table className="stat-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Player", "Team", "G", "GS", "PO", "A", "E", "DP", "FldPct"].map(
                          (col) => (
                            <th
                              key={col}
                              className={`py-2 px-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                              ${col === "Player" ? "text-left sticky left-0 z-20 bg-surface" : col === "Team" ? "text-left" : "text-right"}`}
                            >
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {players.map((f) => {
                        const fpct = fieldingPct(f.PO || 0, f.A || 0, f.E || 0);
                        return (
                          <tr key={`${f.playerID}-${f.stint}-${f.POS}`}>
                            <td className="py-2 px-2.5 text-left font-medium sticky left-0 z-10 bg-surface">
                              <Link
                                href={`/baseball/players/${f.playerID}`}
                                className="text-link hover:text-link-hover hover:underline transition-colors"
                              >
                                {fullName(f.player.nameFirst, f.player.nameLast, f.player.nameGiven, f.player.nameSuffix)}
                              </Link>
                            </td>
                            <td className="py-2 px-2.5 text-left text-xs text-muted font-mono">
                              {f.teamID}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono text-xs">{f.G}</td>
                            <td className="py-2 px-2.5 text-right font-mono text-xs">{f.GS}</td>
                            <td className="py-2 px-2.5 text-right font-mono text-xs">{f.PO}</td>
                            <td className="py-2 px-2.5 text-right font-mono text-xs">{f.A}</td>
                            <td className="py-2 px-2.5 text-right font-mono text-xs">{f.E}</td>
                            <td className="py-2 px-2.5 text-right font-mono text-xs">{f.DP}</td>
                            <td className="py-2 px-2.5 text-right font-mono text-xs font-medium">
                              {fmtAvg(fpct)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
