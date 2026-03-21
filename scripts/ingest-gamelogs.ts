/**
 * Ingest only Retrosheet game logs (run after main ingest if it failed on gamelogs)
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const RETROSHEET_DIR = path.join(__dirname, "..", "data", "gamelogs");

function toInt(val: string | undefined): number | null {
  if (!val || val === "" || val === "NA") return null;
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  if (n > 2147483647 || n < -2147483648) return null;
  return n;
}

function toStr(val: string | undefined): string | null {
  if (!val || val === "" || val === "NA") return null;
  return val;
}

async function main() {
  console.log("Ingesting Retrosheet Game Logs...");

  const txtFiles = fs.existsSync(RETROSHEET_DIR)
    ? fs.readdirSync(RETROSHEET_DIR)
        .filter((f) => f.endsWith(".TXT") || f.endsWith(".txt"))
        .sort()
    : [];

  if (txtFiles.length === 0) {
    console.log("  No game log files found.");
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
          vAB: toInt(f[21]), vH: toInt(f[22]), v2B: toInt(f[23]), v3B: toInt(f[24]),
          vHR: toInt(f[25]), vRBI: toInt(f[26]), vSH: toInt(f[27]), vSF: toInt(f[28]),
          vHBP: toInt(f[29]), vBB: toInt(f[30]), vIBB: toInt(f[31]), vSO: toInt(f[32]),
          vSB: toInt(f[33]), vCS: toInt(f[34]), vGDP: toInt(f[35]), vCI: toInt(f[36]),
          vLOB: toInt(f[37]),
          vPitchersUsed: toInt(f[38]), vIndividualER: toInt(f[39]), vTeamER: toInt(f[40]),
          vWP: toInt(f[41]), vBalks: toInt(f[42]),
          vPO: toInt(f[43]), vA: toInt(f[44]), vE: toInt(f[45]),
          vPB: toInt(f[46]), vDP: toInt(f[47]), vTP: toInt(f[48]),
          hAB: toInt(f[49]), hH: toInt(f[50]), h2B: toInt(f[51]), h3B: toInt(f[52]),
          hHR: toInt(f[53]), hRBI: toInt(f[54]), hSH: toInt(f[55]), hSF: toInt(f[56]),
          hHBP: toInt(f[57]), hBB: toInt(f[58]), hIBB: toInt(f[59]), hSO: toInt(f[60]),
          hSB: toInt(f[61]), hCS: toInt(f[62]), hGDP: toInt(f[63]), hCI: toInt(f[64]),
          hLOB: toInt(f[65]),
          hPitchersUsed: toInt(f[66]), hIndividualER: toInt(f[67]), hTeamER: toInt(f[68]),
          hWP: toInt(f[69]), hBalks: toInt(f[70]),
          hPO: toInt(f[71]), hA: toInt(f[72]), hE: toInt(f[73]),
          hPB: toInt(f[74]), hDP: toInt(f[75]), hTP: toInt(f[76]),
          hpUmpireId: toStr(f[77]), hpUmpireName: toStr(f[78]),
          firstBUmpireId: toStr(f[79]), firstBUmpireName: toStr(f[80]),
          secondBUmpireId: toStr(f[81]), secondBUmpireName: toStr(f[82]),
          thirdBUmpireId: toStr(f[83]), thirdBUmpireName: toStr(f[84]),
          vManagerId: toStr(f[89]), vManagerName: toStr(f[90]),
          hManagerId: toStr(f[91]), hManagerName: toStr(f[92]),
          wpId: toStr(f[93]), wpName: toStr(f[94]),
          lpId: toStr(f[95]), lpName: toStr(f[96]),
          svId: toStr(f[97]), svName: toStr(f[98]),
          gwRBIId: toStr(f[99]), gwRBIName: toStr(f[100]),
          vStartPId: toStr(f[101]), vStartPName: toStr(f[102]),
          hStartPId: toStr(f[103]), hStartPName: toStr(f[104]),
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
  console.log(` done`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
