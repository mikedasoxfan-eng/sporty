import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtRecord, fmtWinPct } from "@/lib/format";

export const metadata = { title: "Teams" };

async function getData() {
  try {
    const franchises = await prisma.teamsFranchises.findMany({
      where: { active: "Y" },
      include: {
        teams: {
          orderBy: { yearID: "desc" },
          take: 1,
        },
      },
    });

    // Group by league using the latest year's lgID
    const al: typeof franchises = [];
    const nl: typeof franchises = [];

    for (const f of franchises) {
      const latest = f.teams[0];
      if (!latest) continue;
      if (latest.lgID === "AL") {
        al.push(f);
      } else {
        nl.push(f);
      }
    }

    // Sort each league alphabetically by franchise name
    al.sort((a, b) => (a.franchName || "").localeCompare(b.franchName || ""));
    nl.sort((a, b) => (a.franchName || "").localeCompare(b.franchName || ""));

    return { al, nl, hasData: al.length > 0 || nl.length > 0 };
  } catch {
    return { al: [], nl: [], hasData: false };
  }
}

export default async function TeamsPage() {
  const { al, nl, hasData } = await getData();

  if (!hasData) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-semibold tracking-tighter mb-4">Teams</h1>
        <p className="text-muted">No team data found.</p>
      </div>
    );
  }

  const leagues = [
    { name: "American League", teams: al },
    { name: "National League", teams: nl },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/baseball"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Baseball
          </Link>
          <span className="text-xs text-muted-light">/</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
          Franchise Index
        </h1>
        <p className="text-muted mt-2 text-sm">
          All active MLB franchises
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {leagues.map(({ name, teams }) => (
          <div key={name}>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
              {name}
            </h2>
            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              <div className="px-4 py-2 border-b border-border bg-surface-alt flex">
                <span className="flex-1 text-xs font-medium text-muted uppercase tracking-wider">
                  Team
                </span>
                <span className="w-14 text-right text-xs text-muted">W-L</span>
                <span className="w-12 text-right text-xs text-muted">Pct</span>
              </div>
              <div className="divide-y divide-border-light">
                {teams.map((f) => {
                  const latest = f.teams[0];
                  if (!latest) return null;
                  return (
                    <Link
                      key={f.franchID}
                      href={`/baseball/teams/${latest.teamID}`}
                      className="flex items-center px-4 py-2.5 hover:bg-surface-alt transition-colors"
                    >
                      <span className="flex-1 text-sm font-medium">
                        {f.franchName}
                      </span>
                      <span className="w-14 text-right text-sm font-mono">
                        {fmtRecord(latest.W || 0, latest.L || 0)}
                      </span>
                      <span className="w-12 text-right text-sm font-mono text-muted">
                        {fmtWinPct(latest.W || 0, latest.L || 0)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
