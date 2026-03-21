import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fullName, fmtAvg } from "@/lib/format";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ awardId: string; year: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { awardId, year } = await params;
  return { title: `${decodeURIComponent(awardId)} ${year} Voting` };
}

async function getData(awardId: string, year: number) {
  const votes = await prisma.awardsSharePlayers.findMany({
    where: { awardID: awardId, yearID: year },
    orderBy: [{ lgID: "asc" }, { pointsWon: "desc" }],
    include: {
      player: {
        select: { nameFirst: true, nameLast: true, nameGiven: true, nameSuffix: true },
      },
    },
  });

  if (votes.length === 0) return null;

  return { votes };
}

export default async function AwardVotingPage({ params }: Props) {
  const { awardId: rawAwardId, year: yearStr } = await params;
  const awardId = decodeURIComponent(rawAwardId);
  const year = parseInt(yearStr);
  const data = await getData(awardId, year);

  if (!data) notFound();

  const { votes } = data;

  // Group by league
  const leagues = new Map<string, typeof votes>();
  for (const v of votes) {
    const lg = v.lgID;
    if (!leagues.has(lg)) leagues.set(lg, []);
    leagues.get(lg)!.push(v);
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
            href="/baseball/awards"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Awards
          </Link>
          <span className="text-xs text-muted-light">/</span>
          <Link
            href={`/baseball/awards/${encodeURIComponent(awardId)}`}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            {awardId}
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {year} <span className="text-muted">{awardId} Voting</span>
        </h1>
      </div>

      {/* Voting tables by league */}
      {Array.from(leagues.entries()).map(([lg, lgVotes]) => (
        <section key={lg} className="mb-10">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
            {lg === "AL" ? "American League" : lg === "NL" ? "National League" : lg}
          </h2>
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="stat-scroll overflow-x-auto">
              <table className="stat-table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-left sticky left-0 z-20 bg-surface">
                      #
                    </th>
                    <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-left">
                      Player
                    </th>
                    <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-right">
                      Points Won
                    </th>
                    <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-right">
                      Points Max
                    </th>
                    <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-right">
                      1st Place
                    </th>
                    <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-right">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {lgVotes.map((v, i) => {
                    const share =
                      v.pointsWon !== null && v.pointsMax
                        ? v.pointsWon / v.pointsMax
                        : null;
                    return (
                      <tr
                        key={`${v.playerID}-${v.lgID}`}
                        className={i === 0 ? "bg-accent/5" : ""}
                      >
                        <td className="py-2 px-3 text-left font-mono text-xs text-muted sticky left-0 z-10 bg-surface">
                          {i + 1}
                        </td>
                        <td className="py-2 px-3 text-left">
                          <Link
                            href={`/baseball/players/${v.playerID}`}
                            className="text-link hover:text-link-hover hover:underline transition-colors"
                          >
                            {fullName(v.player.nameFirst, v.player.nameLast, v.player.nameGiven, v.player.nameSuffix)}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs font-medium">
                          {v.pointsWon !== null ? v.pointsWon : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-muted">
                          {v.pointsMax ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {v.votesFirst ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {share !== null ? fmtAvg(share) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
