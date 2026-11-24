import * as XLSX from "xlsx";
import { HttpError } from "../../../utils/errors.js";

export type CarrollLine = {
  partNumber: string;
  description: string;
  perPackListPrice: number;
  quantityPerPack: number;
  perPackNetPrice: number;
  discountPercent: number;
  categoryDiscountCode: string;
  categoryProduct: string;
  sheetName: string;
  sourceRow: number;
};
export type CarrollPreview = {
  filename: string;
  effectiveDate: string | null;
  totalItems: number;
  ready: boolean;
  sheets: { name: string; count: number; headerRow: number }[];
  warnings: string[];
  sample: CarrollLine[];
};
export type CarrollParsed = { preview: CarrollPreview; lines: CarrollLine[] };

type Field =
  | "partNumber"
  | "description"
  | "listPrice"
  | "quantity"
  | "netPrice"
  | "discount"
  | "discountCode"
  | "productCategory";
type Positions = Record<Field, number>;
const fields: Field[] = [
  "partNumber",
  "description",
  "listPrice",
  "quantity",
  "netPrice",
  "discount",
  "discountCode",
  "productCategory",
];

const normalize = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const text = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const cell = (sheet: XLSX.WorkSheet, row: number, col: number) =>
  sheet[XLSX.utils.encode_cell({ r: row, c: col })];
function displayText(entry: XLSX.CellObject | undefined): string {
  if (!entry || entry.v == null) return "";
  // XLSX's .w can retain leading-zero item codes formatted as text.
  if (entry.t === "n" && /^0\d+$/.test(String(entry.w ?? "")))
    return text(entry.w);
  return text(entry.v);
}
function numeric(entry: XLSX.CellObject | undefined): number | null {
  if (!entry || entry.v == null) return null;
  const value =
    typeof entry.v === "number"
      ? entry.v
      : Number(text(entry.v).replace(/[$,\s]/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function quantity(entry: XLSX.CellObject | undefined): number | null {
  if (!entry || entry.v == null) return null;

  const value = displayText(entry).replace(/,/g, "").trim();

  // Supports 5, 50m, 100m, 100 MTS, 100 metres, etc.
  const match = value.match(
    /^(\d+(?:\.\d+)?)\s*(?:M|MT|MTS|METRE|METRES|METER|METERS)?$/i,
  );

  if (!match) return null;

  const number = Number(match[1]);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function percent(entry: XLSX.CellObject | undefined): number | null {
  if (!entry || entry.v == null) return null;

  // Text-formatted percentages, e.g. "70%"
  if (typeof entry.v === "string" && entry.v.includes("%")) {
    const value = Number(entry.v.replace(/[%\s,]/g, ""));

    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  }

  const raw = numeric(entry);
  if (raw == null) return null;

  const formattedAsPercent =
    (typeof entry.z === "string" && entry.z.includes("%")) ||
    entry.z === 9 ||
    entry.z === 10 ||
    String(entry.w ?? "").includes("%");

  const value = formattedAsPercent && raw <= 1 ? raw * 100 : raw;

  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function detectHeader(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
): { row: number; dataRow: number; positions: Positions } | null {
  // The supplier's headings span/wrap across rows 11-12; we read each column's
  // text on up to three consecutive rows, supporting vertically merged cells.
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 75); row++) {
    const positions: Partial<Positions> = {};
    for (let col = range.s.c; col <= Math.min(range.e.c, 45); col++) {
      const key = normalize(
        [0, 1, 2]
          .map((delta) => displayText(cell(sheet, row + delta, col)))
          .join(" "),
      );
      if (!key) continue;
      const has = (word: string) => key.includes(word);
      const candidates: Array<[Field, boolean]> = [
        [
          "partNumber",
          has("PARTNUMBER") ||
            has("NUMBERPART") ||
            key === "PARTNO" ||
            key === "PART",
        ],
        ["description", has("PRODUCTDESCRIPTION") || key === "DESCRIPTION"],
        [
          "listPrice",
          has("PERPACKLISTPRICE") || (has("LISTPRICE") && !has("NETPRICE")),
        ],
        ["quantity", has("QUANTITY") && has("PACK")],
        [
          "netPrice",
          has("PERPACKNETPRICE") || (has("NETPRICE") && has("PACK")),
        ],
        [
          "discount",
          (has("DISCOUNT") || key === "PERCENT") &&
            !has("CODE") &&
            !has("CATEGORY"),
        ],
        ["discountCode", has("CATEGORYDISCOUNTCODE") || has("DISCOUNTCODE")],
        ["productCategory", has("CATEGORYPRODUCT") || has("PRODUCTCATEGORY")],
      ];
      for (const [field, match] of candidates) {
        if (match && positions[field] === undefined) positions[field] = col;
      }
    }
    if (
      fields.every((key) => positions[key] !== undefined) &&
      new Set(Object.values(positions)).size === fields.length
    ) {
      // A match may start one row before the visible header because it
      // combines up to three rows. Find the FIRST real data row explicitly,
      // so split headers do not cause false validation errors or lost items.
      const p = positions as Positions;
      for (
        let dataRow = row + 1;
        dataRow <= Math.min(range.e.r, row + 10);
        dataRow++
      ) {
        const part = displayText(cell(sheet, dataRow, p.partNumber));
        if (
          part &&
          numeric(cell(sheet, dataRow, p.listPrice)) !== null &&
          numeric(cell(sheet, dataRow, p.netPrice)) !== null
        ) {
          const actualHeader =
            [row, row + 1, row + 2].find((r) =>
              /NUMBER|PART/i.test(displayText(cell(sheet, r, p.partNumber))),
            ) ?? row;
          return { row: actualHeader, dataRow, positions: p };
        }
      }
      // Do not accept a header-only sheet without any valid priced rows.
      return null;
    }
  }
  return null;
}

const MONTHS: Record<string, number> = {
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12,
};
function findEffectiveDate(workbook: XLSX.WorkBook): string | null {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet?.["!ref"]) continue;
    const ref = XLSX.utils.decode_range(sheet["!ref"]);
    const head: string[] = [];
    for (let r = ref.s.r; r <= Math.min(ref.e.r, 18); r++) {
      for (let c = ref.s.c; c <= Math.min(ref.e.c, 10); c++) {
        const value = displayText(cell(sheet, r, c));
        if (value) head.push(value);
      }
    }
    const joined = head.join(" ");
    // 'Prices effective from 3rd August 2026' (the screenshot).
    const found = joined.match(
      /PRICES?\s+EFFECTIVE\s+(?:FROM|ON)\s+(\d{1,2})(?:ST|ND|RD|TH)?\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(20\d{2})/i,
    );
    if (found) {
      const year = Number(found[3]),
        month = MONTHS[found[2].toUpperCase()],
        day = Number(found[1]);
      const checked = new Date(Date.UTC(year, month - 1, day));
      if (
        checked.getUTCFullYear() === year &&
        checked.getUTCMonth() + 1 === month &&
        checked.getUTCDate() === day
      ) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }
  return null;
}

export function parseCarrollWorkbook(
  buffer: Buffer,
  filename: string,
): CarrollParsed {
  if (!/\.xlsx?$/i.test(filename))
    throw new HttpError(400, "Choose a Carroll .xls or .xlsx workbook.");
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellText: true,
      cellNF: true,
    });
  } catch {
    throw new HttpError(400, "Could not read the Carroll workbook.");
  }
  const lines: CarrollLine[] = [];
  const warnings: string[] = [];
  const sheets: CarrollPreview["sheets"] = [];
  let invalid = 0;
  const effectiveDate = findEffectiveDate(workbook);
  if (!effectiveDate)
    warnings.push(
      "Price effective date not found. Check the source before importing.",
    );

  for (const sheetName of workbook.SheetNames) {
    // Ignore Carroll reference sheets
    if (/^discount\s*codes?$/i.test(sheetName.trim())) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const header = detectHeader(sheet, range);
    if (!header) {
      warnings.push(
        `${sheetName}: Carroll price table header not found; sheet ignored.`,
      );
      continue;
    }
    const p = header.positions;
    let count = 0;
    for (let row = header.dataRow; row <= range.e.r; row++) {
      const partEntry = cell(sheet, row, p.partNumber);
      const partNumber = displayText(partEntry);
      const description = displayText(cell(sheet, row, p.description));
      const listPrice = numeric(cell(sheet, row, p.listPrice));
      const quantityPerPack = quantity(cell(sheet, row, p.quantity));
      const netPrice = numeric(cell(sheet, row, p.netPrice));
      const discountPercent = percent(cell(sheet, row, p.discount));
      const categoryDiscountCode = displayText(
        cell(sheet, row, p.discountCode),
      );
      const categoryProduct = displayText(cell(sheet, row, p.productCategory));
      if (
        !partNumber &&
        !description &&
        listPrice === null &&
        netPrice === null
      )
        continue;
      // Ignore repeated headers, notes and purely textual footer rows.
      if (/^(PART|PARTNUMBER|NUMBERPART)$/i.test(normalize(partNumber)))
        continue;
      if (!partNumber && listPrice === null && netPrice === null) continue;
      // Do not silently skip product rows when prices are missing.
      if (
        listPrice === null ||
        netPrice === null ||
        !description ||
        !quantityPerPack ||
        discountPercent === null ||
        !categoryDiscountCode ||
        !categoryProduct ||
        partNumber.length > 100 ||
        description.length > 10000 ||
        categoryDiscountCode.length > 80 ||
        categoryProduct.length > 255 ||
        listPrice > 1e13 ||
        netPrice > 1e13 ||
        quantityPerPack > 1e12
      ) {
        invalid++;
        if (warnings.length < 30)
          warnings.push(
            `${sheetName} row ${row + 1}: incomplete/invalid Carroll product`,
          );
        continue;
      }
      if (partEntry?.t === "n" && Math.abs(Number(partEntry.v)) >= 1e15) {
        invalid++;
        if (warnings.length < 30)
          warnings.push(
            `${sheetName} row ${row + 1}: long part number must be stored as text`,
          );
        continue;
      }
      lines.push({
        partNumber,
        description,
        perPackListPrice: listPrice,
        quantityPerPack,
        perPackNetPrice: netPrice,
        discountPercent,
        categoryDiscountCode,
        categoryProduct,
        sheetName: sheetName.slice(0, 128),
        sourceRow: row + 1,
      });
      count++;
      if (lines.length > 250000)
        throw new HttpError(400, "Carroll workbook exceeds 250,000 items");
    }
    sheets.push({ name: sheetName, count, headerRow: header.row + 1 });
  }
  if (invalid)
    warnings.push(
      `${invalid} product row(s) did not meet validation and were not imported.`,
    );
  // Invalid data blocks an import. A missing optional cover sheet does not.
  const ready = lines.length > 0 && invalid === 0;
  return {
    lines,
    preview: {
      filename,
      effectiveDate,
      totalItems: lines.length,
      ready,
      sheets,
      warnings,
      sample: lines.slice(0, 12),
    },
  };
}
