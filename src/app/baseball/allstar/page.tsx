import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = { title: "All-Star Games" };

async function getData() {
  try {
    const years = await prisma.allstarFull.findMany({
      select: { yearID: true },
      distinct: ["yearID"],
      orderBy: { yearID: "desc" },
    });

    return { years: years.map((y) => y.yearID), hasData: years.length > 0 };
  } catch {
    return { years: [], hasData: false };
  }
}

export default async function AllStarIndexPage() {
  const { years, hasData } = await getData();

  if (!hasData) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-semibold tracking-tighter mb-4">All-Star Games</h1>
        <p className="text-muted">No All-Star game data found.</p>
      </div>
    );
  }

  // Group years by decade
  const decades = new Map<number, number[]>();
  for (const year of years) {
    const decade = Math.floor(year / 10) * 10;
    if (!decades.has(decade)) decades.set(decade, []);
    decades.get(decade)!.push(year);
  }

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
          All-Star Games
        </h1>
        <p className="text-muted mt-2 text-sm">
          Midsummer Classic rosters from {years[years.length - 1]} to {years[0]}
        </p>
      </div>

      <div className="space-y-8">
        {Array.from(decades.entries()).map(([decade, decadeYears]) => (
          <section key={decade}>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
              {decade}s
            </h2>
            <div className="flex flex-wrap gap-2">
              {decadeYears.map((year) => (
                <Link
                  key={year}
                  href={`/baseball/allstar/${year}`}
                  className="px-3 py-1.5 text-sm font-mono rounded-md border border-border hover:bg-surface-alt text-muted hover:text-foreground transition-colors"
                >
                  {year}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
