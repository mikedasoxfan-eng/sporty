import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = { title: "Awards" };

// Group awards into categories
const awardCategories: Record<string, string[]> = {
  "Most Valuable Player": ["Most Valuable Player"],
  "Cy Young": ["Cy Young Award"],
  "Rookie of the Year": ["Rookie of the Year"],
  "Gold Glove": ["Gold Glove"],
  "Silver Slugger": ["Silver Slugger"],
  "Manager of the Year": ["Manager of the Year"],
  "Relief Pitcher": ["Rolaids Relief Man Award", "Relief Man Award"],
};

function categorize(awardID: string): string {
  for (const [category, awards] of Object.entries(awardCategories)) {
    if (awards.some((a) => awardID.toLowerCase().includes(a.toLowerCase()))) {
      return category;
    }
  }
  return "Other Awards";
}

async function getData() {
  try {
    const awards = await prisma.awardsPlayers.findMany({
      select: { awardID: true },
      distinct: ["awardID"],
      orderBy: { awardID: "asc" },
    });

    return { awards: awards.map((a) => a.awardID), hasData: awards.length > 0 };
  } catch {
    return { awards: [], hasData: false };
  }
}

export default async function AwardsPage() {
  const { awards, hasData } = await getData();

  if (!hasData) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-semibold tracking-tighter mb-4">Awards</h1>
        <p className="text-muted">No awards data found.</p>
      </div>
    );
  }

  // Group awards by category
  const grouped: Record<string, string[]> = {};
  for (const award of awards) {
    const cat = categorize(award);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(award);
  }

  // Order: known categories first, then "Other Awards"
  const categoryOrder = [
    "Most Valuable Player",
    "Cy Young",
    "Rookie of the Year",
    "Gold Glove",
    "Silver Slugger",
    "Relief Pitcher",
    "Manager of the Year",
    "Other Awards",
  ];

  const sortedCategories = categoryOrder.filter((c) => grouped[c]);
  // Add any categories not in the predefined order
  for (const cat of Object.keys(grouped)) {
    if (!sortedCategories.includes(cat)) {
      sortedCategories.push(cat);
    }
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
          Awards
        </h1>
        <p className="text-muted mt-2 text-sm">
          MLB player awards history
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sortedCategories.map((category) => (
          <div key={category}>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
              {category}
            </h2>
            <div className="border border-border rounded-lg overflow-hidden bg-surface divide-y divide-border-light">
              {grouped[category].map((award) => (
                <Link
                  key={award}
                  href={`/baseball/awards/${encodeURIComponent(award)}`}
                  className="block px-4 py-3 hover:bg-surface-alt transition-colors"
                >
                  <span className="text-sm text-link hover:text-link-hover transition-colors">
                    {award}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
