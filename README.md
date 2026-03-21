# sporty

Modern sports statistics. A clean, fast, no-ads replacement for Baseball-Reference.com.

Every player. Every season. Every stat. Since 1871.

## Stack

- **Next.js 16** with App Router and React Server Components
- **PostgreSQL** via Docker
- **Prisma 6** ORM
- **Tailwind CSS v4** with Geist font
- **Lahman Database** (1871-2025) + **Retrosheet Game Logs**

## Quick Start

```bash
# Install dependencies
npm install

# Start Postgres
docker compose up -d

# Push database schema
npm run db:push

# Download data sources (Lahman + Retrosheet)
npm run data:download

# Ingest data into Postgres
npm run data:ingest

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

- `/` -- Home
- `/baseball` -- Baseball overview with current standings
- `/baseball/players/[id]` -- Player page (batting, pitching, fielding, awards, salary)
- `/baseball/teams/[teamId]/[year]` -- Team season page
- `/baseball/seasons/[year]` -- Season overview with standings and team stats
- `/baseball/seasons/[year]/batting` -- Batting leaders
- `/baseball/seasons/[year]/pitching` -- Pitching leaders

## Data Sources

- **[Lahman Baseball Database](https://sabr.org/lahman-database/)** -- Complete batting, pitching, fielding stats from 1871-2025, plus player bios, teams, awards, Hall of Fame voting, postseason stats, managers, parks, salaries, and Negro Leagues data.
- **[Retrosheet Game Logs](https://www.retrosheet.org/gamelogs/)** -- ~230,000 games with 161 columns each: scores, starters, stats, umpires, attendance, line scores.

The information used here was obtained free of charge from and is copyrighted by Retrosheet.

## Architecture

Built for multi-sport expansion. The URL structure (`/baseball/...`) and database schema are designed to accommodate football, basketball, hockey, and soccer alongside baseball.

## License

MIT
