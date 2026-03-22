/**
 * Download NFL data from nflverse and related sources
 *
 * Usage: npx tsx scripts/nfl-download.ts
 *
 * Downloads CSV files for:
 *   - Players, Teams, Games/Schedule
 *   - Player stats (offense, defense, kicking)
 *   - Draft picks, Standings
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const DATA_DIR = path.join(__dirname, "..", "data");
const NFL_DIR = path.join(DATA_DIR, "nfl");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  Already exists: ${path.basename(dest)}`);
      return resolve();
    }
    console.log(`  Downloading: ${url}`);
    const file = fs.createWriteStream(dest);

    const request = (currentUrl: string, redirectCount = 0) => {
      if (redirectCount > 10) {
        reject(new Error(`Too many redirects for ${url}`));
        return;
      }

      const get = currentUrl.startsWith("https") ? https.get : require("http").get;

      get(currentUrl, (response: any) => {
        // Follow redirects
        if (
          response.statusCode === 301 ||
          response.statusCode === 302 ||
          response.statusCode === 307 ||
          response.statusCode === 308
        ) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log(`  Redirecting...`);
            request(redirectUrl, redirectCount + 1);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${response.statusCode} for ${currentUrl}`));
          return;
        }

        const totalBytes = parseInt(response.headers["content-length"] || "0", 10);
        let downloadedBytes = 0;
        let lastPercent = -1;

        response.on("data", (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.floor((downloadedBytes / totalBytes) * 100);
            if (percent !== lastPercent && percent % 10 === 0) {
              lastPercent = percent;
              process.stdout.write(`  Progress: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB)\r`);
            }
          }
        });

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          const sizeMB = (downloadedBytes / 1024 / 1024).toFixed(1);
          console.log(`  Downloaded: ${path.basename(dest)} (${sizeMB}MB)`);
          resolve();
        });
      }).on("error", (err: Error) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    };

    request(url);
  });
}

// nflverse release data base URL
const NFLVERSE_BASE = "https://github.com/nflverse/nflverse-data/releases/download";

interface DownloadItem {
  url: string;
  dest: string;
  description: string;
}

const DOWNLOADS: DownloadItem[] = [
  // Core roster/reference data
  {
    url: `${NFLVERSE_BASE}/players/players.csv`,
    dest: path.join(NFL_DIR, "players.csv"),
    description: "NFL Players roster",
  },
  {
    url: `${NFLVERSE_BASE}/teams/teams_colors_logos.csv`,
    dest: path.join(NFL_DIR, "teams.csv"),
    description: "NFL Teams with colors and logos",
  },
  {
    url: `${NFLVERSE_BASE}/schedules/games.csv`,
    dest: path.join(NFL_DIR, "games.csv"),
    description: "NFL Schedule and game results",
  },

  // Draft picks
  {
    url: `${NFLVERSE_BASE}/draft_picks/draft_picks.csv`,
    dest: path.join(NFL_DIR, "draft_picks.csv"),
    description: "NFL Draft picks (historical)",
  },

  // Player stats (aggregated, 1999-2024)
  {
    url: `${NFLVERSE_BASE}/player_stats/player_stats.csv`,
    dest: path.join(NFL_DIR, "player_stats.csv"),
    description: "NFL Player stats - offense (1999-2024, ~33MB)",
  },
  {
    url: `${NFLVERSE_BASE}/player_stats/player_stats_def.csv`,
    dest: path.join(NFL_DIR, "player_stats_def.csv"),
    description: "NFL Player stats - defense",
  },
  {
    url: `${NFLVERSE_BASE}/player_stats/player_stats_kicking.csv`,
    dest: path.join(NFL_DIR, "player_stats_kicking.csv"),
    description: "NFL Player stats - kicking",
  },

  // 2025 season stats (separate release tag)
  {
    url: `${NFLVERSE_BASE}/stats_player/stats_player_reg_2025.csv`,
    dest: path.join(NFL_DIR, "stats_player_2025_reg.csv"),
    description: "NFL Player stats - 2025 regular season",
  },
  {
    url: `${NFLVERSE_BASE}/stats_player/stats_player_post_2025.csv`,
    dest: path.join(NFL_DIR, "stats_player_2025_post.csv"),
    description: "NFL Player stats - 2025 postseason",
  },

  // Standings (from Lee Sharpe's nfldata repo)
  {
    url: "https://raw.githubusercontent.com/leesharpe/nfldata/master/data/standings.csv",
    dest: path.join(NFL_DIR, "standings.csv"),
    description: "NFL Standings (historical, Lee Sharpe)",
  },
];

async function main() {
  ensureDir(DATA_DIR);
  ensureDir(NFL_DIR);

  console.log("NFL Data Pipeline - Download Phase");
  console.log("===================================\n");
  console.log(`Target directory: ${NFL_DIR}\n`);

  let successes = 0;
  let failures = 0;

  for (const item of DOWNLOADS) {
    console.log(`\n[${item.description}]`);
    try {
      await download(item.url, item.dest);
      successes++;
    } catch (err: any) {
      console.error(`  ERROR: ${err.message}`);
      failures++;
    }
  }

  console.log("\n===================================");
  console.log(`Download complete: ${successes} succeeded, ${failures} failed`);

  if (failures > 0) {
    console.log("\nSome downloads failed. You can re-run this script to retry.");
    console.log("Files that already exist will be skipped.");
  }

  console.log("\nDownloaded files:");
  if (fs.existsSync(NFL_DIR)) {
    const files = fs.readdirSync(NFL_DIR);
    for (const file of files) {
      const stat = fs.statSync(path.join(NFL_DIR, file));
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
      console.log(`  ${file} (${sizeMB}MB)`);
    }
  }

  console.log("\nNext: Run `npx tsx scripts/nfl-ingest.ts` to load into database");
}

main().catch(console.error);
