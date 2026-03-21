import Link from "next/link";
import { SearchBar } from "@/components/ui/SearchBar";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              sporty
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/baseball"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Baseball
              </Link>
              <Link
                href="/baseball/seasons/2024"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                2024 Season
              </Link>
              <Link
                href="/baseball/seasons/2024/batting"
                className="text-sm text-muted hover:text-foreground transition-colors"
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
    </header>
  );
}
