import Link from "next/link";
import { SearchBar } from "@/components/ui/SearchBar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navLinks = [
  { href: "/baseball", label: "Baseball" },
  { href: "/football", label: "Football" },
  { href: "/baseball/grid", label: "Grid" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-header-bg text-header-fg">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-lg font-bold tracking-tight text-white"
              >
                sporty
              </Link>
              <nav className="hidden md:flex items-center gap-5">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-white/80 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-full max-w-xs">
                <SearchBar />
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
