/** Parses one logical AKS quotation table row, not free-form terms text. */
export type AksLine = {
  partNo: string;
  description: string;
  price: number;
  uom: string;
  moq: string;
  rowNumber: number | null;
};

const UNIT = String.raw`(?:MTS?|METRES?|METERS?|ROLLS?|PCS?|EACH|EA|LM|FT)`;
// Require an explicit monetary price and two separate quantity/unit columns.
// A part number has at least two letters and at least one digit (e.g. ABC111203).
const ROW = new RegExp(
  String.raw`^(?:(\d{1,4})\s+)?([A-Z]{2,}[A-Z0-9/_-]*\d[A-Z0-9/_-]*)\s+(.+?)\s+(?:AU\s*)?\$\s*([\d,]+(?:\.\d{1,2})?)\s+(\d+(?:\.\d+)?\s*${UNIT})\s+(\d+(?:\.\d+)?\s*${UNIT})\s*$`,
  "i",
);

export function parseAksLine(source: string): AksLine | null {
  const line = source.replace(/\s+/g, " ").trim();
  const m = ROW.exec(line);
  if (!m) return null;
  const price = Number(m[4].replace(/,/g, ""));
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) return null;
  return {
    partNo: m[2].toUpperCase(),
    description: m[3].trim(),
    price,
    uom: m[5].toUpperCase().replace(/\s+/g, ""),
    moq: m[6].toUpperCase().replace(/\s+/g, ""),
    rowNumber: m[1] ? Number(m[1]) : null,
  };
}

/**
 * A PDF may wrap an item's description onto another physical text line.
 * Price/UOM/MOQ may appear on either line, sometimes before the rest of the
 * description in extracted text order. Collect the item block first and move
 * the price/quantity columns to the end before using the strict row parser.
 */
export function parseAksRowBlock(lines: string[]): AksLine | null {
  const combined = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!combined) return null;

  const direct = parseAksLine(combined);
  if (direct) return direct;

  const priceColumns = new RegExp(
    String.raw`(?:AU\s*)?\$\s*[\d,]+(?:\.\d{1,2})?\s+\d+(?:\.\d+)?\s*${UNIT}\s+\d+(?:\.\d+)?\s*${UNIT}(?=\s|$)`,
    "i",
  );
  const match = priceColumns.exec(combined);
  if (!match || match.index === undefined) return null;

  // Example extracted order:
  // 4 ASC16503 4.59MM ... V90 $231.19 100mt 30mts Standard Non-Stripe Colours Only
  // becomes:
  // 4 ASC16503 4.59MM ... V90 Standard Non-Stripe Colours Only $231.19 100mt 30mts
  const before = combined.slice(0, match.index);
  const after = combined.slice(match.index + match[0].length);
  return parseAksLine(`${before} ${after} ${match[0]}`);
}
