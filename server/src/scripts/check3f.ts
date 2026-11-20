import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePriceWorkbook } from '../features/prices/workbook.js';

const file=process.argv[2];
if(!file) {
  console.error('Usage: npm run check:3f -- "C:\\path\\to\\3f-file.xls"');
  process.exit(1);
}
const result=await parsePriceWorkbook(await readFile(file),path.basename(file));
console.log(`\nPreview: ${result.filename} (${result.sheets.length} sheets)`);
for(const s of result.sheets) {
  console.log(`${s.name}: ${s.items} items; tier ${s.selectedRange ?? 'SELECT MANUALLY'}; ${s.skipped} skipped; detected by ${s.detectedBy}`);
  for(const notice of s.warnings) console.log('   - '+notice);
}
console.log(`Total valid items: ${result.totalItems}`);
