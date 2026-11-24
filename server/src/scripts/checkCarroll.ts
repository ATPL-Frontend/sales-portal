import fs from "node:fs";
import { parseCarrollWorkbook } from "../features/prices/carroll/workbook.js";

const file = process.argv[2];
if (!file) {
  console.error(
    "Usage: npx tsx server/src/scripts/checkCarroll.ts <path-to-Carroll.xls[x]>",
  );
  process.exit(2);
}
const parsed = parseCarrollWorkbook(fs.readFileSync(file), file);
console.log(JSON.stringify(parsed.preview, null, 2));
if (!parsed.preview.ready) process.exitCode = 1;
