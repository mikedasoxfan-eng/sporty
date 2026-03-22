import Link from "next/link";

const linkClass = "text-sm text-muted hover:text-foreground transition-colors";

export function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div>
            <p className="text-sm font-medium text-foreground mb-3">sporty</p>
            <p className="text-xs text-muted leading-relaxed max-w-[30ch]">
              Modern sports statistics. Every player, every season, every
              stat.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-light uppercase tracking-wider mb-3">
              Baseball
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/baseball" className={linkClass}>Overview</Link>
              <Link href="/baseball/teams" className={linkClass}>Teams</Link>
              <Link href="/baseball/seasons/2025" className={linkClass}>2025 Season</Link>
              <Link href="/baseball/seasons/2025/batting" className={linkClass}>Leaders</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-light uppercase tracking-wider mb-3">
              Explore
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/baseball/awards" className={linkClass}>Awards</Link>
              <Link href="/baseball/allstar" className={linkClass}>All-Star Games</Link>
              <Link href="/baseball/compare" className={linkClass}>Compare Players</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-light uppercase tracking-wider mb-3">
              Data Sources
            </p>
            <div className="flex flex-col gap-2">
              <a href="https://sabr.org/lahman-database/" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Lahman Database
              </a>
              <a href="https://www.retrosheet.org/" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Retrosheet
              </a>
              <a href="https://statsapi.mlb.com" target="_blank" rel="noopener noreferrer" className={linkClass}>
                MLB Stats API
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-light uppercase tracking-wider mb-3">
              Coming Soon
            </p>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-light">Football</span>
              <span className="text-sm text-muted-light">Basketball</span>
              <span className="text-sm text-muted-light">Hockey</span>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border">
          <p className="retrosheet-credit">
            The information used here was obtained free of charge from and is
            copyrighted by Retrosheet. Lahman Baseball Database is licensed
            under CC BY-SA 3.0.
          </p>
        </div>
      </div>
    </footer>
  );
}
