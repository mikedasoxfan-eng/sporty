import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtAvg, fmtInt, fullName } from "@/lib/format";
import { Baseball } from "@phosphor-icons/react/dist/ssr/Baseball";
import { TrendUp } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";
import { Calendar } from "@phosphor-icons/react/dist/ssr/Calendar";

async function getOverviewStats() {
  try {
    const [playerCount, teamCount, latestYear, recentBatters] =
      await Promise.all([
        prisma.people.count(),
        prisma.teamsFranchises.count({ where: { active: "Y" } }),
        prisma.teams.findFirst({
          orderBy: { yearID: "desc" },
          select: { yearID: true },
        }),
        prisma.batting.findMany({
          where: {
            yearID: { gte: 2023 },
            AB: { gte: 400 },
          },
          include: {
            player: { select: { nameFirst: true, nameLast: true, nameGiven: true } },
          },
          orderBy: [{ H: "desc" }],
          take: 5,
        }),
      ]);

    return {
      playerCount,
      teamCount,
      latestYear: latestYear?.yearID || 2024,
      recentBatters,
      hasData: playerCount > 0,
    };
  } catch {
    return {
      playerCount: 0,
      teamCount: 0,
      latestYear: 2024,
      recentBatters: [],
      hasData: false,
    };
  }
}

export default async function HomePage() {
  const stats = await getOverviewStats();

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero — left-aligned, asymmetric */}
      <section className="py-16 md:py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12 items-start">
          <div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none text-foreground">
              Every stat.
              <br />
              Every player.
              <br />
              <span className="text-muted">Since 1871.</span>
            </h1>
            <p className="mt-6 text-base text-muted leading-relaxed max-w-[50ch]">
              A modern, clean, fast interface for baseball statistics. Complete
              data from the Lahman Database and Retrosheet — no ads, no
              clutter.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/baseball"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg
                           hover:bg-accent-light transition-colors active:scale-[0.98]"
              >
                <Baseball size={18} weight="regular" />
                Explore Baseball
              </Link>
              <Link
                href={`/baseball/seasons/${stats.latestYear}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-sm font-medium rounded-lg
                           hover:bg-surface-alt transition-colors active:scale-[0.98]"
              >
                {stats.latestYear} Season
              </Link>
            </div>
          </div>

          {/* Quick stats sidebar */}
          {stats.hasData && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center">
                  <Users size={16} weight="regular" className="text-muted" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight font-mono">
                    {fmtInt(stats.playerCount)}
                  </p>
                  <p className="text-xs text-muted">Players in database</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center">
                  <TrendUp size={16} weight="regular" className="text-muted" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight font-mono">
                    {fmtInt(stats.teamCount)}
                  </p>
                  <p className="text-xs text-muted">Active franchises</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center">
                  <Calendar
                    size={16}
                    weight="regular"
                    className="text-muted"
                  />
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight font-mono">
                    155
                  </p>
                  <p className="text-xs text-muted">Years of data</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {!stats.hasData && (
        <section className="pb-16">
          <div className="border border-border rounded-lg p-8 bg-surface">
            <h2 className="text-lg font-semibold mb-2">
              Set up data pipeline
            </h2>
            <p className="text-sm text-muted mb-4 max-w-[65ch]">
              The database is empty. Run the data pipeline to download and
              ingest the Lahman Database and Retrosheet game logs.
            </p>
            <div className="bg-surface-alt rounded-lg p-4 font-mono text-sm space-y-1">
              <p className="text-muted"># Start Postgres</p>
              <p>docker compose up -d</p>
              <p className="text-muted mt-3"># Set up database schema</p>
              <p>npx prisma db push</p>
              <p className="text-muted mt-3"># Download data</p>
              <p>npx tsx scripts/download.ts</p>
              <p className="text-muted mt-3"># Ingest into database</p>
              <p>npx tsx scripts/ingest.ts</p>
            </div>
          </div>
        </section>
      )}

      {/* Recent batting leaders */}
      {stats.recentBatters.length > 0 && (
        <section className="pb-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Recent Batting Leaders
              </h2>
              <p className="text-sm text-muted mt-1">By hits, 400+ AB</p>
            </div>
            <Link
              href={`/baseball/seasons/${stats.latestYear}/batting`}
              className="text-sm text-accent hover:text-accent-light transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="border border-border rounded-lg overflow-hidden bg-surface divide-y divide-border-light">
            {stats.recentBatters.map((b, i) => {
              const avg =
                b.AB && b.AB > 0 ? (b.H! / b.AB).toFixed(3) : "—";
              return (
                <Link
                  key={b.id}
                  href={`/baseball/players/${b.playerID}`}
                  className="flex items-center px-4 py-3 hover:bg-surface-alt transition-colors"
                >
                  <span className="w-8 text-xs text-muted font-mono">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium text-sm">
                    {fullName(b.player.nameFirst, b.player.nameLast, b.player.nameGiven)}
                  </span>
                  <span className="text-sm text-muted mr-6">{b.teamID}</span>
                  <span className="w-12 text-right font-mono text-sm">
                    {b.H}
                  </span>
                  <span className="w-16 text-right font-mono text-sm text-muted">
                    {fmtAvg(Number(avg))}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
