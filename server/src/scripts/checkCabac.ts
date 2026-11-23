import { readFile } from "node:fs/promises";
import { parseCabacWorkbook } from "../features/prices/cabac/workbook.js";

const input = process.argv[2];
if (!input) {
  console.error(
    'Usage: npm run check:cabac -w server -- "C:\\path\\to\\CABAC.xlsx"',
  );
  process.exit(1);
}
const file = await readFile(input);
const result = parseCabacWorkbook(
  file,
  input.split(/[\\/]/).pop() ?? "CABAC.xlsx",
);
console.log(JSON.stringify(result.preview, null, 2));
if (!result.preview.ready) process.exitCode = 1;
