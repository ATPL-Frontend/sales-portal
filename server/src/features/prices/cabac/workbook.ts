import * as XLSX from "xlsx";
import { HttpError } from "../../../utils/errors.js";

export type CabacLine = {
  itemCode: string;
  itemDescription: string;
  quantity: number;
  quantityPer: number;
  unit: string;
  offerPrice: number;
  currency: string;
  sheetName: string;
  sourceRow: number;
};

export type CabacPreview = {
  filename: string;
  totalItems: number;
  sheets: { name: string; count: number; headerRow: number }[];
  warnings: string[];
  ready: boolean;
  sample: CabacLine[];
};

export type ParsedCabac = { preview: CabacPreview; lines: CabacLine[] };
type Column =
  | "code"
  | "description"
  | "quantity"
  | "quantityPer"
  | "unit"
  | "price"
  | "currency";
type Positions = Record<Column, number>;

const ALIASES: Record<Column, string[]> = {
  code: ["ITEMCODE", "PRODUCTCODE"],
  description: ["ITEMDESCRIPTION", "DESCRIPTION", "PRODUCTDESCRIPTION"],
  quantity: ["QUANTITY", "QTY"],
  quantityPer: ["QUANTITYPER", "QTYPER"],
  unit: ["UNIT", "UN", "UOM"],
  price: ["OFFERPRICE", "OFFERPRIC", "PRICE"],
  currency: ["CURRENCY", "CURRENC"],
};
const columns = Object.keys(ALIASES) as Column[];
const canonical = (value: unknown) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const text = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

function cell(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number,
): XLSX.CellObject | undefined {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })];
}

function cellText(
  value: XLSX.CellObject | undefined,
  itemCode = false,
): string {
  if (!value || value.v == null) return "";
  // Codes should normally be text in Excel. For numeric cells, a displayed
  // zero-padded format may preserve their leading zeros in the .w property.
  if (itemCode && value.t === "n" && /^0\d+$/.test(String(value.w ?? ""))) {
    return text(value.w);
  }
  return text(value.v);
}

function toNumber(input: string): number | null {
  const normalized = input.replace(/[$,\s]/g, "");
  if (!normalized || !/^(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function locateHeader(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
): { row: number; pos: Positions } | null {
  const last = Math.min(range.e.r, range.s.r + 60);
  for (let r = range.s.r; r <= last; r++) {
    const found: Partial<Positions> = {};
    for (let c = range.s.c; c <= Math.min(range.e.c, 45); c++) {
      const key = canonical(cellText(cell(sheet, r, c)));
      if (!key) continue;
      for (const col of columns) {
        if (ALIASES[col].includes(key) && found[col] == null) found[col] = c;
      }
    }
    if (columns.every((col) => found[col] !== undefined)) {
      return { row: r, pos: found as Positions };
    }
  }
  return null;
}

export function parseCabacWorkbook(
  buffer: Buffer,
  filename: string,
): ParsedCabac {
  if (!/\.xlsx?$/i.test(filename))
    throw new HttpError(400, "Upload a CABAC .xls or .xlsx file.");
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellText: true,
      cellNF: true,
    });
  } catch {
    throw new HttpError(400, "Excel workbook could not be read.");
  }
  const lines: CabacLine[] = [];
  const warnings: string[] = [];
  const sheets: CabacPreview["sheets"] = [];
  let invalid = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const header = locateHeader(sheet, range);
    if (!header) {
      warnings.push(`${sheetName}: required CABAC column headers not found`);
      invalid++;
      continue;
    }
    let count = 0;
    for (let row = header.row + 1; row <= range.e.r; row++) {
      const p = header.pos;
      const codeCell = cell(sheet, row, p.code);
      const itemCode = cellText(codeCell, true);
      const itemDescription = cellText(cell(sheet, row, p.description));
      const quantityText = cellText(cell(sheet, row, p.quantity));
      const quantityPerText = cellText(cell(sheet, row, p.quantityPer));
      const unit = cellText(cell(sheet, row, p.unit));
      const priceText = cellText(cell(sheet, row, p.price));
      const currency = cellText(cell(sheet, row, p.currency)).toUpperCase();
      const values = [
        itemCode,
        itemDescription,
        quantityText,
        quantityPerText,
        unit,
        priceText,
        currency,
      ];
      if (!values.some(Boolean)) continue;
      // Repeated print headers and footer labels are not products.
      if (canonical(itemCode) === "ITEMCODE") continue;
      if (!itemCode) continue;
      const quantity = toNumber(quantityText);
      const quantityPer = toNumber(quantityPerText);
      const offerPrice = toNumber(priceText);
      if (
        !itemDescription ||
        !unit ||
        !/^[A-Z]{3}$/.test(currency) ||
        quantity === null ||
        quantityPer === null ||
        offerPrice === null ||
        offerPrice > 99999999999999 ||
        itemCode.length > 100 ||
        unit.length > 40
      ) {
        invalid++;
        if (warnings.length < 30)
          warnings.push(
            `${sheetName}, row ${row + 1}: invalid or missing required item values`,
          );
        continue;
      }
      // Excel stores numbers using at most ~15 significant digits. If a long
      // item code is numeric, it might already have lost precision or zeros.
      if (codeCell?.t === "n" && Math.abs(Number(codeCell.v)) >= 1e15) {
        invalid++;
        if (warnings.length < 30)
          warnings.push(
            `${sheetName}, row ${row + 1}: item code must be stored as Excel text to preserve all digits`,
          );
        continue;
      }
      lines.push({
        itemCode,
        itemDescription,
        quantity,
        quantityPer,
        unit,
        offerPrice,
        currency,
        sheetName: sheetName.slice(0, 128),
        sourceRow: row + 1,
      });
      count++;
      if (lines.length > 200000)
        throw new HttpError(400, "CABAC workbook exceeds 200,000 items");
    }
    sheets.push({ name: sheetName, count, headerRow: header.row + 1 });
  }
  const ready = lines.length > 0 && invalid === 0;
  return {
    lines,
    preview: {
      filename,
      totalItems: lines.length,
      sheets,
      warnings,
      ready,
      sample: lines.slice(0, 12),
    },
  };
}
