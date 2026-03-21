/**
 * Ingest Lahman + Retrosheet data into PostgreSQL
 *
 * Usage: npx tsx scripts/ingest.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();
const LAHMAN_DIR = path.join(__dirname, "..", "data", "lahman");
const RETROSHEET_DIR = path.join(__dirname, "..", "data", "gamelogs");

function readCSV(filename: string): Record<string, string>[] {
  const filepath = path.join(LAHMAN_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`  Skipping ${filename} (not found)`);
    return [];
  }
  // Strip BOM if present
  const content = fs.readFileSync(filepath, "utf-8").replace(/^\uFEFF/, "");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });
}

function toInt(val: string | undefined): number | null {
  if (!val || val === "" || val === "NA") return null;
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  // Protect against INT4 overflow (Postgres max: 2,147,483,647)
  if (n > 2147483647 || n < -2147483648) return null;
  return n;
}

function toFloat(val: string | undefined): number | null {
  if (!val || val === "" || val === "NA") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toStr(val: string | undefined): string | null {
  if (!val || val === "" || val === "NA") return null;
  return val;
}

async function ingestPeople() {
  console.log("Ingesting People...");
  const rows = readCSV("People.csv");
  if (rows.length === 0) return;

  // Batch upsert
  let count = 0;
  const batch = 500;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.people.upsert({
          where: { playerID: r.playerID },
          update: {},
          create: {
            playerID: r.playerID,
            birthYear: toInt(r.birthYear),
            birthMonth: toInt(r.birthMonth),
            birthDay: toInt(r.birthDay),
            birthCountry: toStr(r.birthCountry),
            birthState: toStr(r.birthState),
            birthCity: toStr(r.birthCity),
            deathYear: toInt(r.deathYear),
            deathMonth: toInt(r.deathMonth),
            deathDay: toInt(r.deathDay),
            deathCountry: toStr(r.deathCountry),
            deathState: toStr(r.deathState),
            deathCity: toStr(r.deathCity),
            nameFirst: toStr(r.nameFirst),
            nameLast: toStr(r.nameLast),
            nameGiven: toStr(r.nameGiven),
            weight: toInt(r.weight),
            height: toInt(r.height),
            bats: toStr(r.bats),
            throws: toStr(r.throws),
            debut: toStr(r.debut),
            finalGame: toStr(r.finalGame),
            retroID: toStr(r.retroID),
            bbrefID: toStr(r.bbrefID),
          },
        })
      )
    );
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${rows.length} people`);
  }
  console.log(` ✓`);
}

async function ingestSchools() {
  console.log("Ingesting Schools...");
  const rows = readCSV("Schools.csv");
  if (rows.length === 0) return;

  let count = 0;
  const batch = 500;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.schools.upsert({
          where: { schoolID: r.schoolID },
          update: {},
          create: {
            schoolID: r.schoolID,
            name_full: toStr(r.name_full),
            city: toStr(r.city),
            state: toStr(r.state),
            country: toStr(r.country),
          },
        })
      )
    );
    count += chunk.length;
  }
  console.log(`  ${count} schools ✓`);
}

async function ingestParks() {
  console.log("Ingesting Parks...");
  const rows = readCSV("Parks.csv");
  if (rows.length === 0) return;

  let count = 0;
  const batch = 500;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.parks.upsert({
          where: { parkKey: r["park.key"] || r.parkkey || r.ID || "" },
          update: {},
          create: {
            parkKey: r["park.key"] || r.parkkey || r.ID || "",
            parkName: toStr(r["park.name"] || r.parkname || r.Name),
            parkAlias: toStr(r["park.alias"] || r.parkalias || r.Alias),
            city: toStr(r.city || r.City),
            state: toStr(r.state || r.State),
            country: toStr(r.country || r.Country),
          },
        })
      )
    );
    count += chunk.length;
  }
  console.log(`  ${count} parks ✓`);
}

async function ingestTeamsFranchises() {
  console.log("Ingesting TeamsFranchises...");
  const rows = readCSV("TeamsFranchises.csv");
  if (rows.length === 0) return;

  let count = 0;
  for (const r of rows) {
    await prisma.teamsFranchises.upsert({
      where: { franchID: r.franchID },
      update: {},
      create: {
        franchID: r.franchID,
        franchName: toStr(r.franchName),
        active: toStr(r.active),
        NAassoc: toStr(r.NAassoc),
      },
    });
    count++;
  }
  console.log(`  ${count} franchises ✓`);
}

async function ingestTeams() {
  console.log("Ingesting Teams...");
  const rows = readCSV("Teams.csv");
  if (rows.length === 0) return;

  let count = 0;
  const batch = 200;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    for (const r of chunk) {
      try {
        await prisma.teams.upsert({
          where: {
            yearID_lgID_teamID: {
              yearID: toInt(r.yearID) || 0,
              lgID: r.lgID || "",
              teamID: r.teamID || "",
            },
          },
          update: {},
          create: {
            yearID: toInt(r.yearID) || 0,
            lgID: r.lgID || "",
            teamID: r.teamID || "",
            franchID: toStr(r.franchID),
            divID: toStr(r.divID),
            Rank: toInt(r.Rank),
            G: toInt(r.G),
            Ghome: toInt(r.Ghome),
            W: toInt(r.W),
            L: toInt(r.L),
            DivWin: toStr(r.DivWin),
            WCWin: toStr(r.WCWin),
            LgWin: toStr(r.LgWin),
            WSWin: toStr(r.WSWin),
            R: toInt(r.R),
            AB: toInt(r.AB),
            H: toInt(r.H),
            doubles: toInt(r["2B"]),
            triples: toInt(r["3B"]),
            HR: toInt(r.HR),
            BB: toInt(r.BB),
            SO: toInt(r.SO),
            SB: toInt(r.SB),
            CS: toInt(r.CS),
            HBP: toInt(r.HBP),
            SF: toInt(r.SF),
            RA: toInt(r.RA),
            ER: toInt(r.ER),
            ERA: toFloat(r.ERA),
            CG: toInt(r.CG),
            SHO: toInt(r.SHO),
            SV: toInt(r.SV),
            IPouts: toInt(r.IPouts),
            HA: toInt(r.HA),
            HRA: toInt(r.HRA),
            BBA: toInt(r.BBA),
            SOA: toInt(r.SOA),
            E: toInt(r.E),
            DP: toInt(r.DP),
            FP: toFloat(r.FP),
            name: toStr(r.name),
            park: toStr(r.park),
            attendance: toInt(r.attendance),
            BPF: toInt(r.BPF),
            PPF: toInt(r.PPF),
            teamIDBR: toStr(r.teamIDBR),
            teamIDlahman45: toStr(r.teamIDlahman45),
            teamIDretro: toStr(r.teamIDretro),
          },
        });
      } catch {
        // Skip duplicates
      }
    }
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${rows.length} teams`);
  }
  console.log(` ✓`);
}

async function ingestBatting() {
  console.log("Ingesting Batting...");
  const rows = readCSV("Batting.csv");
  if (rows.length === 0) return;

  // Clear existing data for clean re-import
  await prisma.batting.deleteMany();

  let count = 0;
  const batch = 1000;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.batting.createMany({
      data: chunk.map((r) => ({
        playerID: r.playerID,
        yearID: toInt(r.yearID) || 0,
        stint: toInt(r.stint) || 1,
        teamID: r.teamID || "",
        lgID: toStr(r.lgID),
        G: toInt(r.G),
        AB: toInt(r.AB),
        R: toInt(r.R),
        H: toInt(r.H),
        doubles: toInt(r["2B"]),
        triples: toInt(r["3B"]),
        HR: toInt(r.HR),
        RBI: toInt(r.RBI),
        SB: toInt(r.SB),
        CS: toInt(r.CS),
        BB: toInt(r.BB),
        SO: toInt(r.SO),
        IBB: toInt(r.IBB),
        HBP: toInt(r.HBP),
        SH: toInt(r.SH),
        SF: toInt(r.SF),
        GIDP: toInt(r.GIDP),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${rows.length} batting rows`);
  }
  console.log(` ✓`);
}

async function ingestPitching() {
  console.log("Ingesting Pitching...");
  const rows = readCSV("Pitching.csv");
  if (rows.length === 0) return;

  await prisma.pitching.deleteMany();

  let count = 0;
  const batch = 1000;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.pitching.createMany({
      data: chunk.map((r) => ({
        playerID: r.playerID,
        yearID: toInt(r.yearID) || 0,
        stint: toInt(r.stint) || 1,
        teamID: r.teamID || "",
        lgID: toStr(r.lgID),
        W: toInt(r.W),
        L: toInt(r.L),
        G: toInt(r.G),
        GS: toInt(r.GS),
        CG: toInt(r.CG),
        SHO: toInt(r.SHO),
        SV: toInt(r.SV),
        IPouts: toInt(r.IPouts),
        H: toInt(r.H),
        ER: toInt(r.ER),
        HR: toInt(r.HR),
        BB: toInt(r.BB),
        SO: toInt(r.SO),
        BAOpp: toFloat(r.BAOpp),
        ERA: toFloat(r.ERA),
        IBB: toInt(r.IBB),
        WP: toInt(r.WP),
        HBP: toInt(r.HBP),
        BK: toInt(r.BK),
        BFP: toInt(r.BFP),
        GF: toInt(r.GF),
        R: toInt(r.R),
        SH: toInt(r.SH),
        SF: toInt(r.SF),
        GIDP: toInt(r.GIDP),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${rows.length} pitching rows`);
  }
  console.log(` ✓`);
}

async function ingestFielding() {
  console.log("Ingesting Fielding...");
  const rows = readCSV("Fielding.csv");
  if (rows.length === 0) return;

  await prisma.fielding.deleteMany();

  let count = 0;
  const batch = 1000;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.fielding.createMany({
      data: chunk.map((r) => ({
        playerID: r.playerID,
        yearID: toInt(r.yearID) || 0,
        stint: toInt(r.stint) || 1,
        teamID: r.teamID || "",
        lgID: toStr(r.lgID),
        POS: r.POS || "",
        G: toInt(r.G),
        GS: toInt(r.GS),
        InnOuts: toInt(r.InnOuts),
        PO: toInt(r.PO),
        A: toInt(r.A),
        E: toInt(r.E),
        DP: toInt(r.DP),
        PB: toInt(r.PB),
        WP: toInt(r.WP),
        SB: toInt(r.SB),
        CS: toInt(r.CS),
        ZR: toFloat(r.ZR),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${rows.length} fielding rows`);
  }
  console.log(` ✓`);
}

async function ingestAppearances() {
  console.log("Ingesting Appearances...");
  const rows = readCSV("Appearances.csv");
  if (rows.length === 0) return;

  await prisma.appearances.deleteMany();

  let count = 0;
  const batch = 1000;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.appearances.createMany({
      data: chunk.map((r) => ({
        yearID: toInt(r.yearID) || 0,
        teamID: r.teamID || "",
        lgID: toStr(r.lgID),
        playerID: r.playerID,
        G_all: toInt(r.G_all),
        GS: toInt(r.GS),
        G_batting: toInt(r.G_batting),
        G_defense: toInt(r.G_defense),
        G_p: toInt(r.G_p),
        G_c: toInt(r.G_c),
        G_1b: toInt(r.G_1b),
        G_2b: toInt(r.G_2b),
        G_3b: toInt(r.G_3b),
        G_ss: toInt(r.G_ss),
        G_lf: toInt(r.G_lf),
        G_cf: toInt(r.G_cf),
        G_rf: toInt(r.G_rf),
        G_of: toInt(r.G_of),
        G_dh: toInt(r.G_dh),
        G_ph: toInt(r.G_ph),
        G_pr: toInt(r.G_pr),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  ${count}/${rows.length} appearance rows`);
  }
  console.log(` ✓`);
}

async function ingestPostseason() {
  console.log("Ingesting Postseason Batting...");
  const bRows = readCSV("BattingPost.csv");
  if (bRows.length > 0) {
    await prisma.battingPost.deleteMany();
    const batch = 500;
    for (let i = 0; i < bRows.length; i += batch) {
      const chunk = bRows.slice(i, i + batch);
      await prisma.battingPost.createMany({
        data: chunk.map((r) => ({
          yearID: toInt(r.yearID) || 0,
          round: r.round || "",
          playerID: r.playerID,
          teamID: toStr(r.teamID),
          lgID: toStr(r.lgID),
          G: toInt(r.G),
          AB: toInt(r.AB),
          R: toInt(r.R),
          H: toInt(r.H),
          doubles: toInt(r["2B"]),
          triples: toInt(r["3B"]),
          HR: toInt(r.HR),
          RBI: toInt(r.RBI),
          SB: toInt(r.SB),
          CS: toInt(r.CS),
          BB: toInt(r.BB),
          SO: toInt(r.SO),
          IBB: toInt(r.IBB),
          HBP: toInt(r.HBP),
          SH: toInt(r.SH),
          SF: toInt(r.SF),
          GIDP: toInt(r.GIDP),
        })),
        skipDuplicates: true,
      });
    }
    console.log(`  ${bRows.length} postseason batting rows ✓`);
  }

  console.log("Ingesting Postseason Pitching...");
  const pRows = readCSV("PitchingPost.csv");
  if (pRows.length > 0) {
    await prisma.pitchingPost.deleteMany();
    const batch = 500;
    for (let i = 0; i < pRows.length; i += batch) {
      const chunk = pRows.slice(i, i + batch);
      await prisma.pitchingPost.createMany({
        data: chunk.map((r) => ({
          playerID: r.playerID,
          yearID: toInt(r.yearID) || 0,
          round: r.round || "",
          teamID: toStr(r.teamID),
          lgID: toStr(r.lgID),
          W: toInt(r.W),
          L: toInt(r.L),
          G: toInt(r.G),
          GS: toInt(r.GS),
          CG: toInt(r.CG),
          SHO: toInt(r.SHO),
          SV: toInt(r.SV),
          IPouts: toInt(r.IPouts),
          H: toInt(r.H),
          ER: toInt(r.ER),
          HR: toInt(r.HR),
          BB: toInt(r.BB),
          SO: toInt(r.SO),
          BAOpp: toFloat(r.BAOpp),
          ERA: toFloat(r.ERA),
          IBB: toInt(r.IBB),
          WP: toInt(r.WP),
          HBP: toInt(r.HBP),
          BK: toInt(r.BK),
          BFP: toInt(r.BFP),
          GF: toInt(r.GF),
          R: toInt(r.R),
          SH: toInt(r.SH),
          SF: toInt(r.SF),
          GIDP: toInt(r.GIDP),
        })),
        skipDuplicates: true,
      });
    }
    console.log(`  ${pRows.length} postseason pitching rows ✓`);
  }

  console.log("Ingesting Series Post...");
  const sRows = readCSV("SeriesPost.csv");
  if (sRows.length > 0) {
    await prisma.seriesPost.deleteMany();
    for (const r of sRows) {
      try {
        await prisma.seriesPost.create({
          data: {
            yearID: toInt(r.yearID) || 0,
            round: r.round || "",
            teamIDwinner: toStr(r.teamIDwinner),
            lgIDwinner: toStr(r.lgIDwinner),
            teamIDloser: toStr(r.teamIDloser),
            lgIDloser: toStr(r.lgIDloser),
            wins: toInt(r.wins),
            losses: toInt(r.losses),
            ties: toInt(r.ties),
          },
        });
      } catch {
        // skip duplicates
      }
    }
    console.log(`  ${sRows.length} series rows ✓`);
  }
}

async function ingestAwards() {
  console.log("Ingesting Awards...");

  const apRows = readCSV("AwardsPlayers.csv");
  if (apRows.length > 0) {
    await prisma.awardsPlayers.deleteMany();
    const batch = 500;
    for (let i = 0; i < apRows.length; i += batch) {
      const chunk = apRows.slice(i, i + batch);
      await prisma.awardsPlayers.createMany({
        data: chunk.map((r) => ({
          playerID: r.playerID,
          awardID: r.awardID || "",
          yearID: toInt(r.yearID) || 0,
          lgID: toStr(r.lgID),
          tie: toStr(r.tie),
          notes: toStr(r.notes),
        })),
        skipDuplicates: true,
      });
    }
    console.log(`  ${apRows.length} player awards ✓`);
  }

  const asRows = readCSV("AwardsSharePlayers.csv");
  if (asRows.length > 0) {
    await prisma.awardsSharePlayers.deleteMany();
    const batch = 500;
    for (let i = 0; i < asRows.length; i += batch) {
      const chunk = asRows.slice(i, i + batch);
      await prisma.awardsSharePlayers.createMany({
        data: chunk.map((r) => ({
          awardID: r.awardID || "",
          yearID: toInt(r.yearID) || 0,
          lgID: r.lgID || "",
          playerID: r.playerID,
          pointsWon: toFloat(r.pointsWon),
          pointsMax: toInt(r.pointsMax),
          votesFirst: toInt(r.votesFirst),
        })),
        skipDuplicates: true,
      });
    }
    console.log(`  ${asRows.length} award shares ✓`);
  }

  const allstar = readCSV("AllstarFull.csv");
  if (allstar.length > 0) {
    await prisma.allstarFull.deleteMany();
    const batch = 500;
    for (let i = 0; i < allstar.length; i += batch) {
      const chunk = allstar.slice(i, i + batch);
      await prisma.allstarFull.createMany({
        data: chunk.map((r) => ({
          playerID: r.playerID,
          yearID: toInt(r.yearID) || 0,
          gameNum: toInt(r.gameNum),
          gameID: toStr(r.gameID),
          teamID: toStr(r.teamID),
          lgID: toStr(r.lgID),
          GP: toInt(r.GP),
          startingPos: toInt(r.startingPos),
        })),
      });
    }
    console.log(`  ${allstar.length} all-star appearances ✓`);
  }

  const hof = readCSV("HallOfFame.csv");
  if (hof.length > 0) {
    await prisma.hallOfFame.deleteMany();
    for (const r of hof) {
      await prisma.hallOfFame.create({
        data: {
          playerID: r.playerID,
          yearid: toInt(r.yearid || r.yearID) || 0,
          votedBy: toStr(r.votedBy),
          ballots: toInt(r.ballots),
          needed: toInt(r.needed),
          votes: toInt(r.votes),
          inducted: toStr(r.inducted),
          category: toStr(r.category),
          needed_note: toStr(r.needed_note),
        },
      });
    }
    console.log(`  ${hof.length} HOF records ✓`);
  }
}

async function ingestSalaries() {
  console.log("Ingesting Salaries...");
  const rows = readCSV("Salaries.csv");
  if (rows.length === 0) return;

  await prisma.salaries.deleteMany();

  let count = 0;
  const batch = 1000;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await prisma.salaries.createMany({
      data: chunk.map((r) => ({
        yearID: toInt(r.yearID) || 0,
        teamID: r.teamID || "",
        lgID: r.lgID || "",
        playerID: r.playerID,
        salary: toFloat(r.salary),
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
  }
  console.log(`  ${count} salary records ✓`);
}

async function ingestManagers() {
  console.log("Ingesting Managers...");
  const rows = readCSV("Managers.csv");
  if (rows.length === 0) return;

  await prisma.managers.deleteMany();
  for (const r of rows) {
    try {
      await prisma.managers.create({
        data: {
          playerID: toStr(r.playerID),
          yearID: toInt(r.yearID) || 0,
          teamID: r.teamID || "",
          lgID: toStr(r.lgID),
          inseason: toInt(r.inseason) || 0,
          G: toInt(r.G),
          W: toInt(r.W),
          L: toInt(r.L),
          rank: toInt(r.rank),
          plyrMgr: toStr(r.plyrMgr),
        },
      });
    } catch {
      // skip
    }
  }
  console.log(`  ${rows.length} manager records ✓`);
}

async function ingestCollegePlaying() {
  console.log("Ingesting CollegePlaying...");
  const rows = readCSV("CollegePlaying.csv");
  if (rows.length === 0) return;

  await prisma.collegePlaying.deleteMany();

  // Get valid school and player IDs to filter bad references
  const validSchools = new Set(
    (await prisma.schools.findMany({ select: { schoolID: true } })).map(
      (s) => s.schoolID
    )
  );
  const validPlayers = new Set(
    (await prisma.people.findMany({ select: { playerID: true } })).map(
      (p) => p.playerID
    )
  );

  const filtered = rows.filter(
    (r) => validSchools.has(r.schoolID) && validPlayers.has(r.playerID)
  );
  const batch = 1000;
  let count = 0;
  for (let i = 0; i < filtered.length; i += batch) {
    const chunk = filtered.slice(i, i + batch);
    await prisma.collegePlaying.createMany({
      data: chunk.map((r) => ({
        playerID: r.playerID,
        schoolID: r.schoolID,
        yearID: toInt(r.yearID),
      })),
    });
    count += chunk.length;
  }
  console.log(`  ${count} college records (${rows.length - filtered.length} skipped) ✓`);
}

async function ingestGameLogs() {
  console.log("Ingesting Retrosheet Game Logs...");

  const txtFiles = fs.existsSync(RETROSHEET_DIR)
    ? fs
        .readdirSync(RETROSHEET_DIR)
        .filter((f) => f.endsWith(".TXT") || f.endsWith(".txt"))
        .sort()
    : [];

  if (txtFiles.length === 0) {
    console.log("  No game log files found. Skipping.");
    return;
  }

  await prisma.gameLog.deleteMany();

  let totalCount = 0;

  for (const file of txtFiles) {
    const filepath = path.join(RETROSHEET_DIR, file);
    const content = fs.readFileSync(filepath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    const batch = 500;
    for (let i = 0; i < lines.length; i += batch) {
      const chunk = lines.slice(i, i + batch);
      const data = chunk.map((line) => {
        const f = line.split(",").map((v) => v.replace(/^"|"$/g, ""));

        // Build lineup JSON
        const vLineup = [];
        const hLineup = [];
        for (let b = 0; b < 9; b++) {
          const vi = 105 + b * 3;
          const hi = 132 + b * 3;
          if (f[vi]) vLineup.push({ id: f[vi], name: f[vi + 1], pos: toInt(f[vi + 2]) });
          if (f[hi]) hLineup.push({ id: f[hi], name: f[hi + 1], pos: toInt(f[hi + 2]) });
        }

        return {
          date: f[0] || "",
          gameNumber: toStr(f[1]),
          dayOfWeek: toStr(f[2]),
          visitingTeam: toStr(f[3]),
          visitingLeague: toStr(f[4]),
          visitingGameNum: toInt(f[5]),
          homeTeam: toStr(f[6]),
          homeLeague: toStr(f[7]),
          homeGameNum: toInt(f[8]),
          visitingScore: toInt(f[9]),
          homeScore: toInt(f[10]),
          lengthOuts: toInt(f[11]),
          dayNight: toStr(f[12]),
          completionInfo: toStr(f[13]),
          forfeitInfo: toStr(f[14]),
          protestInfo: toStr(f[15]),
          parkID: toStr(f[16]),
          attendance: toInt(f[17]),
          timeOfGame: toInt(f[18]),
          visitingLine: toStr(f[19]),
          homeLine: toStr(f[20]),
          vAB: toInt(f[21]),
          vH: toInt(f[22]),
          v2B: toInt(f[23]),
          v3B: toInt(f[24]),
          vHR: toInt(f[25]),
          vRBI: toInt(f[26]),
          vSH: toInt(f[27]),
          vSF: toInt(f[28]),
          vHBP: toInt(f[29]),
          vBB: toInt(f[30]),
          vIBB: toInt(f[31]),
          vSO: toInt(f[32]),
          vSB: toInt(f[33]),
          vCS: toInt(f[34]),
          vGDP: toInt(f[35]),
          vCI: toInt(f[36]),
          vLOB: toInt(f[37]),
          vPitchersUsed: toInt(f[38]),
          vIndividualER: toInt(f[39]),
          vTeamER: toInt(f[40]),
          vWP: toInt(f[41]),
          vBalks: toInt(f[42]),
          vPO: toInt(f[43]),
          vA: toInt(f[44]),
          vE: toInt(f[45]),
          vPB: toInt(f[46]),
          vDP: toInt(f[47]),
          vTP: toInt(f[48]),
          hAB: toInt(f[49]),
          hH: toInt(f[50]),
          h2B: toInt(f[51]),
          h3B: toInt(f[52]),
          hHR: toInt(f[53]),
          hRBI: toInt(f[54]),
          hSH: toInt(f[55]),
          hSF: toInt(f[56]),
          hHBP: toInt(f[57]),
          hBB: toInt(f[58]),
          hIBB: toInt(f[59]),
          hSO: toInt(f[60]),
          hSB: toInt(f[61]),
          hCS: toInt(f[62]),
          hGDP: toInt(f[63]),
          hCI: toInt(f[64]),
          hLOB: toInt(f[65]),
          hPitchersUsed: toInt(f[66]),
          hIndividualER: toInt(f[67]),
          hTeamER: toInt(f[68]),
          hWP: toInt(f[69]),
          hBalks: toInt(f[70]),
          hPO: toInt(f[71]),
          hA: toInt(f[72]),
          hE: toInt(f[73]),
          hPB: toInt(f[74]),
          hDP: toInt(f[75]),
          hTP: toInt(f[76]),
          hpUmpireId: toStr(f[77]),
          hpUmpireName: toStr(f[78]),
          firstBUmpireId: toStr(f[79]),
          firstBUmpireName: toStr(f[80]),
          secondBUmpireId: toStr(f[81]),
          secondBUmpireName: toStr(f[82]),
          thirdBUmpireId: toStr(f[83]),
          thirdBUmpireName: toStr(f[84]),
          vManagerId: toStr(f[89]),
          vManagerName: toStr(f[90]),
          hManagerId: toStr(f[91]),
          hManagerName: toStr(f[92]),
          wpId: toStr(f[93]),
          wpName: toStr(f[94]),
          lpId: toStr(f[95]),
          lpName: toStr(f[96]),
          svId: toStr(f[97]),
          svName: toStr(f[98]),
          gwRBIId: toStr(f[99]),
          gwRBIName: toStr(f[100]),
          vStartPId: toStr(f[101]),
          vStartPName: toStr(f[102]),
          hStartPId: toStr(f[103]),
          hStartPName: toStr(f[104]),
          vLineup: JSON.stringify(vLineup),
          hLineup: JSON.stringify(hLineup),
          additionalInfo: toStr(f[159]),
          acquisitionInfo: toStr(f[160]),
        };
      });

      await prisma.gameLog.createMany({ data });
    }

    totalCount += lines.length;
    process.stdout.write(`\r  ${totalCount} games (${file})`);
  }
  console.log(` ✓`);
}

async function main() {
  console.log("Sporty Data Pipeline - Ingest Phase");
  console.log("===================================\n");

  const start = Date.now();

  // Order matters: parent tables first
  await ingestParks();
  await ingestSchools();
  await ingestTeamsFranchises();
  await ingestPeople();
  await ingestTeams();
  await ingestBatting();
  await ingestPitching();
  await ingestFielding();
  await ingestAppearances();
  await ingestPostseason();
  await ingestAwards();
  await ingestSalaries();
  await ingestManagers();
  await ingestCollegePlaying();
  await ingestGameLogs();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nIngest complete in ${elapsed}s!`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
