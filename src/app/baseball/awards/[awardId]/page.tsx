import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fullName } from "@/lib/format";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ awardId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { awardId } = await params;
  return { title: decodeURIComponent(awardId) };
}

async function getData(awardId: string) {
  const winners = await prisma.awardsPlayers.findMany({
    where: { awardID: awardId },
    orderBy: [{ yearID: "desc" }, { lgID: "asc" }],
    include: {
      player: {
        select: { nameFirst: true, nameLast: true, nameGiven: true, nameSuffix: true },
      },
    },
  });

  if (winners.length === 0) return null;

  return { winners, awardId };
}

export default async function AwardHistoryPage({ params }: Props) {
  const { awardId: rawAwardId } = await params;
  const awardId = decodeURIComponent(rawAwardId);
  const data = await getData(awardId);

  if (!data) notFound();

  const { winners } = data;

  // Check if voting data exists for this award
  const hasVoting = await prisma.awardsSharePlayers.findFirst({
    where: { awardID: awardId },
    select: { id: true },
  });

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
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          {awardId}
        </h1>
        <p className="text-muted mt-2 text-sm">
          {winners.length} winner{winners.length !== 1 ? "s" : ""} across{" "}
          {new Set(winners.map((w) => w.yearID)).size} seasons
        </p>
      </div>

      {/* Winners table */}
      <section>
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <div className="stat-scroll overflow-x-auto">
            <table className="stat-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Year", "Player", "League", "Notes"].map((col) => (
                    <th
                      key={col}
                      className={`py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap
                      ${col === "Year" ? "text-left sticky left-0 z-20 bg-surface" : col === "Player" ? "text-left" : "text-left"}`}
                    >
                      {col}
                    </th>
                  ))}
                  {hasVoting && (
                    <th className="py-2 px-3 text-xs font-medium text-muted uppercase tracking-wider text-left">
                      Voting
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {winners.map((w) => (
                  <tr key={`${w.playerID}-${w.yearID}-${w.lgID}`}>
                    <td className="py-2 px-3 text-left font-mono text-xs sticky left-0 z-10 bg-surface">
                      {w.yearID}
                    </td>
                    <td className="py-2 px-3 text-left">
                      <Link
                        href={`/baseball/players/${w.playerID}`}
                        className="text-link hover:text-link-hover hover:underline transition-colors"
                      >
                        {fullName(w.player.nameFirst, w.player.nameLast, w.player.nameGiven, w.player.nameSuffix)}
                      </Link>
                      {w.tie === "Y" && (
                        <span className="ml-1.5 text-xs text-muted">(tie)</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-left text-xs text-muted">
                      {w.lgID || "—"}
                    </td>
                    <td className="py-2 px-3 text-left text-xs text-muted">
                      {w.notes || "—"}
                    </td>
                    {hasVoting && (
                      <td className="py-2 px-3 text-left">
                        <Link
                          href={`/baseball/awards/${encodeURIComponent(awardId)}/${w.yearID}`}
                          className="text-xs text-link hover:text-link-hover hover:underline transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
