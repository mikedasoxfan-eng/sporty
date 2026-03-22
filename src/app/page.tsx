import Link from "next/link";
import { prisma } from "@/lib/db";

async function getStats() {
  try {
    const [mlbPlayers, nflPlayers, mlbTeams, nflTeams] = await Promise.all([
      prisma.people.count(),
      prisma.nFLPlayer.count(),
      prisma.teamsFranchises.count({ where: { active: "Y" } }),
      prisma.nFLTeam.count(),
    ]);
    return { mlbPlayers, nflPlayers, mlbTeams, nflTeams, hasData: mlbPlayers > 0 || nflPlayers > 0 };
  } catch {
    return { mlbPlayers: 0, nflPlayers: 0, mlbTeams: 0, nflTeams: 0, hasData: false };
  }
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="py-16 md:py-24 lg:py-32">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none text-foreground">
            Every stat.
            <br />
            Every player.
            <br />
            <span className="text-muted">Every sport.</span>
          </h1>
          <p className="mt-6 text-base text-muted leading-relaxed max-w-[50ch]">
            Modern sports statistics — clean, fast, no ads. Complete historical
            data for baseball and football, with more sports coming.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/baseball"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg
                         hover:bg-accent-light transition-colors active:scale-[0.98]"
            >
              Baseball
            </Link>
            <Link
              href="/football"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg
                         hover:bg-accent-light transition-colors active:scale-[0.98]"
            >
              Football
            </Link>
          </div>
        </div>
      </section>

      {/* Sport cards */}
      <section className="pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Baseball */}
          <Link
            href="/baseball"
            className="group border border-border rounded-xl p-6 bg-surface hover:bg-surface-alt transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight group-hover:text-accent transition-colors">
                  Baseball
                </h2>
                <p className="text-sm text-muted mt-1">MLB statistics since 1871</p>
              </div>
              <span className="text-3xl">&#9918;</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-2xl font-semibold font-mono tracking-tight">
                  {stats.mlbPlayers.toLocaleString()}
                </p>
                <p className="text-xs text-muted">Players</p>
              </div>
              <div>
                <p className="text-2xl font-semibold font-mono tracking-tight">
                  {stats.mlbTeams}
                </p>
                <p className="text-xs text-muted">Franchises</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">Player Pages</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">WAR</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">OPS+</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">Grid Game</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">Awards</span>
            </div>
          </Link>

          {/* Football */}
          <Link
            href="/football"
            className="group border border-border rounded-xl p-6 bg-surface hover:bg-surface-alt transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight group-hover:text-accent transition-colors">
                  Football
                </h2>
                <p className="text-sm text-muted mt-1">NFL statistics since 1999</p>
              </div>
              <span className="text-3xl">&#127944;</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-2xl font-semibold font-mono tracking-tight">
                  {stats.nflPlayers.toLocaleString()}
                </p>
                <p className="text-xs text-muted">Players</p>
              </div>
              <div>
                <p className="text-2xl font-semibold font-mono tracking-tight">
                  {stats.nflTeams}
                </p>
                <p className="text-xs text-muted">Teams</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">Player Pages</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">Passer Rating</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">Standings</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-alt text-muted">Schedules</span>
            </div>
          </Link>

          {/* Coming Soon — Basketball */}
          <div className="border border-border rounded-xl p-6 bg-surface opacity-50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Basketball</h2>
                <p className="text-sm text-muted mt-1">Coming soon</p>
              </div>
              <span className="text-3xl">&#127936;</span>
            </div>
          </div>

          {/* Coming Soon — Hockey */}
          <div className="border border-border rounded-xl p-6 bg-surface opacity-50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Hockey</h2>
                <p className="text-sm text-muted mt-1">Coming soon</p>
              </div>
              <span className="text-3xl">&#127954;</span>
            </div>
          </div>
        </div>
      </section>

      {!stats.hasData && (
        <section className="pb-16">
          <div className="border border-border rounded-lg p-8 bg-surface">
            <h2 className="text-lg font-semibold mb-2">Set up data pipeline</h2>
            <p className="text-sm text-muted mb-4">
              Run the data pipeline to load statistics.
            </p>
            <div className="bg-surface-alt rounded-lg p-4 font-mono text-sm space-y-1">
              <p className="text-muted"># Start Postgres</p>
              <p>docker compose up -d</p>
              <p className="text-muted mt-3"># Set up schema</p>
              <p>npx prisma db push</p>
              <p className="text-muted mt-3"># Baseball</p>
              <p>npm run data:pipeline && npm run data:enrich</p>
              <p className="text-muted mt-3"># Football</p>
              <p>npm run nfl:pipeline</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
