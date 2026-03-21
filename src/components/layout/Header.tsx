import Link from "next/link";
import { SearchBar } from "@/components/ui/SearchBar";

export function Header() {
  return (
    <header className="sticky top-0 z-40">
      {/* Primary red bar */}
      <div className="bg-header-bg text-header-fg">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-8">
              <Link
                href="/"
                className="text-lg font-bold tracking-tight text-white"
              >
                sporty
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/baseball"
                  className="text-sm text-white/80 hover:text-white transition-colors"
                >
                  Baseball
                </Link>
                <Link
                  href="/baseball/seasons/2024"
                  className="text-sm text-white/80 hover:text-white transition-colors"
                >
                  Seasons
                </Link>
                <Link
                  href="/baseball/seasons/2024/batting"
                  className="text-sm text-white/80 hover:text-white transition-colors"
                >
                  Leaders
                </Link>
              </nav>
            </div>
            <div className="w-full max-w-xs">
              <SearchBar />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
