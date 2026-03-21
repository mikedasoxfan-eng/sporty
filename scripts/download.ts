/**
 * Download Lahman Baseball Database and Retrosheet Game Logs
 *
 * Usage: npx tsx scripts/download.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

const DATA_DIR = path.join(__dirname, "..", "data");
const LAHMAN_DIR = path.join(DATA_DIR, "lahman");
const RETROSHEET_DIR = path.join(DATA_DIR, "gamelogs");

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
    const get = url.startsWith("https") ? https.get : http.get;

    const request = (currentUrl: string) => {
      get(currentUrl, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log(`  Redirecting to: ${redirectUrl}`);
            request(redirectUrl);
            return;
          }
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${currentUrl}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log(`  Downloaded: ${path.basename(dest)}`);
          resolve();
        });
      }).on("error", (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
    };

    request(url);
  });
}

async function downloadLahman() {
  console.log("\n=== Downloading Lahman Database ===");
  ensureDir(LAHMAN_DIR);

  // The Lahman database CSV files from the GitHub repository
  // Using the seanlahman fork which has updated data
  const baseUrl =
    "https://raw.githubusercontent.com/chadwickbureau/baseballdatabank/master/core";

  const files = [
    "People.csv",
    "Batting.csv",
    "Pitching.csv",
    "Fielding.csv",
    "Teams.csv",
    "TeamsFranchises.csv",
    "TeamsHalf.csv",
    "Appearances.csv",
    "AllstarFull.csv",
    "HallOfFame.csv",
    "AwardsPlayers.csv",
    "AwardsManagers.csv",
    "AwardsSharePlayers.csv",
    "AwardsShareManagers.csv",
    "Salaries.csv",
    "BattingPost.csv",
    "PitchingPost.csv",
    "FieldingPost.csv",
    "FieldingOF.csv",
    "FieldingOFsplit.csv",
    "SeriesPost.csv",
    "Managers.csv",
    "ManagersHalf.csv",
    "Parks.csv",
    "HomeGames.csv",
    "Schools.csv",
    "CollegePlaying.csv",
  ];

  // Try the seanlahman repo first, fallback to chadwickbureau
  const urls = [
    "https://raw.githubusercontent.com/seanlahman/baseballdatabank/master/core",
    "https://raw.githubusercontent.com/chadwickbureau/baseballdatabank/master/core",
  ];

  for (const file of files) {
    const dest = path.join(LAHMAN_DIR, file);
    if (fs.existsSync(dest)) {
      console.log(`  Already exists: ${file}`);
      continue;
    }

    let downloaded = false;
    for (const base of urls) {
      try {
        await download(`${base}/${file}`, dest);
        downloaded = true;
        break;
      } catch (err) {
        console.log(`  Failed from ${base}, trying next source...`);
      }
    }

    if (!downloaded) {
      // Some files may have different names in older versions
      if (file === "People.csv") {
        console.log("  Trying Master.csv as fallback...");
        for (const base of urls) {
          try {
            await download(`${base}/Master.csv`, dest);
            downloaded = true;
            break;
          } catch {
            // continue
          }
        }
      }
      if (!downloaded) {
        console.warn(`  WARNING: Could not download ${file}`);
      }
    }
  }
}

async function downloadRetrosheet() {
  console.log("\n=== Downloading Retrosheet Game Logs ===");
  ensureDir(RETROSHEET_DIR);

  // Download the complete game logs archive
  const zipFile = path.join(RETROSHEET_DIR, "gl1871_2025.zip");

  try {
    await download(
      "https://www.retrosheet.org/gamelogs/gl1871_2024.zip",
      zipFile
    );
  } catch {
    console.log("  Trying individual decade files...");
    const decades = [
      "gl1871_99",
      "gl1900_19",
      "gl1920_39",
      "gl1940_59",
      "gl1960_69",
      "gl1970_79",
      "gl1980_89",
      "gl1990_99",
      "gl2000_09",
      "gl2010_19",
      "gl2020_25",
    ];

    for (const decade of decades) {
      const decadeZip = path.join(RETROSHEET_DIR, `${decade}.zip`);
      try {
        await download(
          `https://www.retrosheet.org/gamelogs/${decade}.zip`,
          decadeZip
        );
      } catch (err) {
        console.warn(`  WARNING: Could not download ${decade}.zip`);
      }
    }
  }

  // Extract zips
  const zipFiles = fs
    .readdirSync(RETROSHEET_DIR)
    .filter((f) => f.endsWith(".zip"));
  for (const zip of zipFiles) {
    const zipPath = path.join(RETROSHEET_DIR, zip);
    console.log(`  Extracting: ${zip}`);
    try {
      execSync(`cd "${RETROSHEET_DIR}" && unzip -o "${zipPath}"`, {
        stdio: "pipe",
      });
    } catch {
      // Try powershell on Windows
      try {
        execSync(
          `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${RETROSHEET_DIR}' -Force"`,
          { stdio: "pipe" }
        );
      } catch (err) {
        console.warn(`  WARNING: Could not extract ${zip}: ${err}`);
      }
    }
  }
}

async function main() {
  ensureDir(DATA_DIR);

  console.log("Sporty Data Pipeline - Download Phase");
  console.log("=====================================");

  await downloadLahman();
  await downloadRetrosheet();

  console.log("\nDownload complete!");
  console.log("Next: Run `npx tsx scripts/ingest.ts` to load into database");
}

main().catch(console.error);
