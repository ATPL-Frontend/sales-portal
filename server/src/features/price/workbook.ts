import * as CFB from "cfb";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { HttpError } from "../../utils/errors.js";

export type PriceLine = {
  sheetName: string;
  category: string;
  ul: string;
  itemNo: string;
  description: string;
  price: number;
  priceRange: string;
  packing: string | null;
  moq: string | null;
  leadTime: string | null;
  sourceRow: number;
};
export type TierOption = { range: string; column: string };
export type SheetPreview = {
  name: string;
  tiers: TierOption[];
  selectedRange: string | null;
  detectedBy: "yellow cell" | "manual" | "not detected";
  items: number;
  skipped: number;
  warnings: string[];
  samples: PriceLine[];
  categories: string[];
};
export type WorkbookPreview = {
  filename: string;
  sheets: SheetPreview[];
  totalItems: number;
  allSelected: boolean;
  lines: PriceLine[];
};

const text = (value: unknown): string =>
  value == null ? "" : String(value).replace(/\s+/g, " ").trim();
const valueAt = (sheet: XLSX.WorkSheet, row: number, col: number): unknown =>
  sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v;
const tierPattern = /^\s*\d{4,6}\s*[-–—]\s*\d{4,6}\s*$/;
const canonical = (value: unknown) =>
  text(value).replace(/[,\s]/g, "").replace(/[–—]/g, "-");
const isMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const safeError = (err: unknown) =>
  err instanceof Error ? err.message : "Unknown error";

function isYellow(argb: string | undefined): boolean {
  if (!argb) return false;
  const rgb = argb.replace(/^#/, "").slice(-6);
  if (!/^[A-F0-9]{6}$/i.test(rgb)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16));
  return r >= 220 && g >= 200 && b <= 100;
}

async function highlightedXlsx(
  buffer: Buffer,
): Promise<Map<string, Set<string>>> {
  const found = new Map<string, Set<string>>();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  workbook.eachSheet((sheet) => {
    const highlighted = new Set<string>();

    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const fill = cell.fill;

        if (fill?.type !== "pattern" || fill.pattern !== "solid") {
          return;
        }

        const fg = fill.fgColor;
        if (!fg) return;

        const isArgbYellow = typeof fg.argb === "string" && isYellow(fg.argb);

        const isIndexedYellow = "indexed" in fg && fg.indexed === 13;

        if (isArgbYellow || isIndexedYellow) {
          highlighted.add(`${row.number - 1}:${Number(cell.col) - 1}`);
        }
      });
    });

    found.set(sheet.name, highlighted);
  });

  return found;
  return found;
}

/**
 * Read BIFF8 XF colors directly from the Workbook stream of legacy .xls.
 * SheetJS reads values reliably but does not consistently expose XLS fill colors.
 * The small BIFF reader here inspects only format records + cells (not formulas/data).
 * For unknown XLS dialects it safely falls back to filename tier / user choice.
 */
function highlightedXls(buffer: Buffer): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const container = CFB.read(buffer, { type: "buffer" });
  const entry = CFB.find(container, "Workbook") ?? CFB.find(container, "Book");
  if (!entry?.content) return found;
  const data = Buffer.from(entry.content);
  const xfs: { fill: number; fore: number }[] = [];
  const bounds: { offset: number; name: string }[] = [];
  const palette = new Map<number, [number, number, number]>();
  // Default BIFF palette index 13 is pure yellow.
  const maxRecords = 200_000;
  let pos = 0;
  for (let n = 0; pos + 4 <= data.length && n < maxRecords; n++) {
    const code = data.readUInt16LE(pos),
      length = data.readUInt16LE(pos + 2);
    const start = pos + 4,
      end = start + length;
    if (end > data.length) break;
    if (code === 0x00e0 && length >= 20) {
      const pattern = data.readUInt32LE(start + 14) >>> 26;
      const foreground = data.readUInt16LE(start + 18) & 0x7f;
      xfs.push({ fill: pattern, fore: foreground });
    }
    if (code === 0x0092 && length >= 2) {
      const count = data.readUInt16LE(start);
      for (let i = 0; i < count && start + 2 + i * 4 + 3 <= end; i++) {
        const p = start + 2 + i * 4;
        palette.set(i + 8, [data[p], data[p + 1], data[p + 2]]);
      }
    }
    if (code === 0x0085 && length >= 8) {
      const sheetOffset = data.readUInt32LE(start);
      const count = data[start + 6],
        flags = data[start + 7];
      const byteSize = flags & 1 ? count * 2 : count;
      if (start + 8 + byteSize <= end)
        bounds.push({
          offset: sheetOffset,
          name: data.toString(
            flags & 1 ? "utf16le" : "latin1",
            start + 8,
            start + 8 + byteSize,
          ),
        });
    }
    pos = end;
    // First EOF terminates workbook globals.
    if (code === 0x000a) break;
  }
  const yellow = (xf: number): boolean => {
    const style = xfs[xf];
    if (!style || style.fill !== 1) return false;
    const rgb = palette.get(style.fore);
    return rgb
      ? rgb[0] >= 220 && rgb[1] >= 200 && rgb[2] <= 100
      : style.fore === 13;
  };
  const cellRecords = new Set([
    0x00fd, 0x0203, 0x027e, 0x0006, 0x0201, 0x0204, 0x00d6,
  ]);
  for (const bound of bounds) {
    const highlights = new Set<string>();
    let cursor = bound.offset;
    for (let n = 0; cursor + 4 <= data.length && n < maxRecords; n++) {
      const code = data.readUInt16LE(cursor),
        len = data.readUInt16LE(cursor + 2);
      const start = cursor + 4,
        end = start + len;
      if (end > data.length) break;
      if (cellRecords.has(code) && len >= 6) {
        const row = data.readUInt16LE(start),
          col = data.readUInt16LE(start + 2),
          xf = data.readUInt16LE(start + 4);
        if (yellow(xf)) highlights.add(`${row}:${col}`);
      }
      cursor = end;
      if (code === 0x000a) break;
    }
    found.set(bound.name, highlights);
  }
  return found;
}

async function discoverHighlights(file: Buffer, filename: string) {
  try {
    return /\.xlsx$/i.test(filename)
      ? await highlightedXlsx(file)
      : highlightedXls(file);
  } catch (err) {
    console.warn("Could not inspect workbook fill colors:", safeError(err));
    return new Map<string, Set<string>>();
  }
}

/**
 * SheetJS stores only the first (top-left) cell's value for a merged range.
 * Vertically merged descriptions must be repeated on each priced item row.
 * Do not copy arbitrary descriptions from previous rows.
 */
function getMergedDescription(
  sheet: XLSX.WorkSheet,
  row: number,
  descriptionCol: number,
): string {
  const own = text(valueAt(sheet, row, descriptionCol));
  if (own) return own;

  const merged = (sheet["!merges"] ?? []).find(
    (range) =>
      range.s.c <= descriptionCol &&
      range.e.c >= descriptionCol &&
      range.s.r <= row &&
      range.e.r >= row,
  );

  return merged ? text(valueAt(sheet, merged.s.r, merged.s.c)) : "";
}

export async function parsePriceWorkbook(
  file: Buffer,
  filename: string,
  userTiers: Record<string, string> = {},
): Promise<WorkbookPreview> {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(file, {
      type: "buffer",
      cellStyles: true,
      cellDates: true,
      sheetStubs: false,
    });
  } catch {
    throw new HttpError(
      400,
      "Cannot read this Excel file. Upload a valid .xls or .xlsx workbook.",
    );
  }
  if (wb.SheetNames.length === 0 || wb.SheetNames.length > 40)
    throw new HttpError(400, "Workbook must have between 1 and 40 worksheets");
  const marked = await discoverHighlights(file, filename);
  const sheets: SheetPreview[] = [];
  const lines: PriceLine[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    if (range.e.r > 20000 || range.e.c > 200)
      throw new HttpError(
        400,
        `Worksheet ${name} is too large (maximum 20,001 rows / 201 columns)`,
      );
    let heading = -1,
      descriptionCol = -1,
      itemCol = -1;
    const maxHeaderRow = Math.min(range.e.r, 90);
    for (let row = 0; row <= maxHeaderRow; row++) {
      let desc = -1,
        item = -1;
      for (let col = 0; col <= Math.min(range.e.c, 30); col++) {
        const txt = text(valueAt(sheet, row, col)).toLowerCase();
        if (txt === "description") desc = col;
        if (txt === "item" || txt === "item no." || txt === "item no")
          item = col;
      }
      if (desc !== -1 && item !== -1) {
        heading = row;
        descriptionCol = desc;
        itemCol = item;
        break;
      }
    }
    if (heading < 0) {
      sheets.push({
        name,
        tiers: [],
        selectedRange: null,
        detectedBy: "not detected",
        items: 0,
        skipped: 0,
        warnings: ["Could not locate the Item / Description headings."],
        samples: [],
        categories: [],
      });
      continue;
    }
    const tierRow = heading + 1;
    const tiers: TierOption[] = [];
    for (let col = descriptionCol + 1; col <= range.e.c; col++) {
      const display = text(valueAt(sheet, tierRow, col));
      if (tierPattern.test(display))
        tiers.push({
          range: canonical(display),
          column: XLSX.utils.encode_col(col),
        });
    }
    if (!tiers.length) {
      sheets.push({
        name,
        tiers: [],
        selectedRange: null,
        detectedBy: "not detected",
        items: 0,
        skipped: 0,
        warnings: ["No LME price ranges found beneath the unit-price heading."],
        samples: [],
        categories: [],
      });
      continue;
    }
    const highlighted = marked.get(name) || new Set<string>();
    const markedTiers = tiers.filter((t) =>
      highlighted.has(`${tierRow}:${XLSX.utils.decode_col(t.column)}`),
    );
    const manual = userTiers[name] && canonical(userTiers[name]);
    let chosen: TierOption | undefined;
    let detectedBy: SheetPreview["detectedBy"] = "not detected";
    if (manual) {
      chosen = tiers.find((t) => t.range === manual);
      if (!chosen)
        throw new HttpError(400, `Invalid range selected for ${name}`);
      detectedBy = "manual";
    } else if (markedTiers.length === 1) {
      chosen = markedTiers[0];
      detectedBy = "yellow cell";
    }
    const extraHeaders: Record<string, number> = {};
    for (let col = 0; col <= range.e.c; col++) {
      const v = text(valueAt(sheet, heading, col))
        .toLowerCase()
        .replace(/\s/g, "");
      if (v.includes("packing") || v.includes("packaging"))
        extraHeaders.packing = col;
      if (v === "moq" || v.startsWith("minimumorder")) extraHeaders.moq = col;
      if (v.includes("leadtime")) extraHeaders.lead = col;
    }
    const warnings: string[] = [];
    const categories = new Set<string>();
    const samples: PriceLine[] = [];
    let skipped = 0,
      imported = 0,
      section = "Uncategorised";
    const selectedCol = chosen ? XLSX.utils.decode_col(chosen.column) : -1;
    for (let row = tierRow + 1; row <= range.e.r; row++) {
      const item = text(valueAt(sheet, row, itemCol));
      const description = getMergedDescription(sheet, row, descriptionCol);
      const selectedValue =
        selectedCol >= 0 ? valueAt(sheet, row, selectedCol) : undefined;
      if (/^remarks\s*:?$/i.test(item)) break;
      if (
        !item &&
        description &&
        /(?:wire|cable)\s*[-–—]\s*UL\s*\d+/i.test(description)
      ) {
        section = description;
        categories.add(section);
        continue;
      }
      if (!/^\d+\.?$/.test(item)) continue;
      if (!chosen) continue;
      if (!description || !isMoney(selectedValue)) {
        skipped++;
        if (warnings.length < 30)
          warnings.push(
            `Row ${row + 1} (${item}): ${!description ? "description missing" : "price missing for " + chosen.range}; skipped.`,
          );
        continue;
      }
      const clean = (column?: number): string | null =>
        column === undefined ? null : text(valueAt(sheet, row, column)) || null;
      const ul =
        (section.match(/UL\s*\d+/gi) || [])
          .map((x) => x.replace(/\s/g, "").toUpperCase())
          .join(" / ") || "—";
      const line: PriceLine = {
        sheetName: name,
        category: section,
        ul,
        itemNo: item.replace(/\.$/, ""),
        description,
        price: Number(selectedValue.toFixed(2)),
        priceRange: chosen.range,
        packing: clean(extraHeaders.packing),
        moq: clean(extraHeaders.moq),
        leadTime: clean(extraHeaders.lead),
        sourceRow: row + 1,
      };
      lines.push(line);
      if (samples.length < 4) samples.push(line);
      imported++;
    }
    if (!chosen)
      warnings.unshift(
        "No unambiguous highlighted LME range found. Select a price range manually.",
      );
    sheets.push({
      name,
      tiers,
      selectedRange: chosen?.range ?? null,
      detectedBy,
      items: imported,
      skipped,
      warnings,
      samples,
      categories: [...categories],
    });
  }
  return {
    filename,
    sheets,
    totalItems: lines.length,
    allSelected: sheets.every(
      (s) => Boolean(s.selectedRange) && s.tiers.length > 0,
    ),
    lines,
  };
}
