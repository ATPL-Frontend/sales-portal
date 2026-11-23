import crypto from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { HttpError } from "../../../utils/errors.js";
import { parseAksRowBlock, type AksLine } from "./lineParser.js";

export type AksItem = AksLine & {
  quoteRef: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  sourceFile: string;
  sourcePage: number;
  sourceRow: number;
};

export type AksFilePreview = {
  filename: string;
  pages: number;
  count: number;
  quoteRef: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  notes: string[];
  unparsedRows: number;
};

export type AksBatch = {
  files: AksFilePreview[];
  items: AksItem[];
  duplicates: string[];
  totalItems: number;
  ready: boolean;
  warnings: string[];
  fingerprint: string;
};

const tidy = (input: string) => input.replace(/\s+/g, " ").trim();

function dateFromAU(input: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
    ? d.toISOString().slice(0, 10)
    : null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** pdfjs-dist yields text runs with x/y coordinates; merge by baseline, then x. */
function logicalRows(
  items: Array<{ str: string; transform: number[] }>,
): string[] {
  const fragments = items
    .filter(
      (i) =>
        typeof i.str === "string" && i.str.trim() && i.transform.length >= 6,
    )
    .map((i) => ({ x: i.transform[4], y: i.transform[5], value: tidy(i.str) }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: Array<{ y: number; parts: typeof fragments }> = [];
  for (const fragment of fragments) {
    // Text for row numbers may sit 1.3pt higher than the description.
    let group = groups.find((g) => Math.abs(g.y - fragment.y) <= 3.2);
    if (!group) {
      group = { y: fragment.y, parts: [] };
      groups.push(group);
    }
    group.parts.push(fragment);
  }
  return groups
    .sort((a, b) => b.y - a.y)
    .map((g) =>
      tidy(
        g.parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.value)
          .join(" "),
      ),
    )
    .filter(Boolean);
}

function metadata(lines: string[]): {
  quoteRef: string | null;
  quoteDate: string | null;
  validUntil: string | null;
} {
  const joined = lines.slice(0, 50).join(" ");
  const quoteRef =
    /\bQuote\s*Ref\s*[:#-]?\s*([A-Z0-9/-]+)/i.exec(joined)?.[1] ?? null;
  const dateText = /\bDate\s*[:#-]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(
    joined,
  )?.[1];
  const quoteDate = dateText ? dateFromAU(dateText) : null;
  const dayCount = /Price\s+valid\s+for\s+(\d{1,3})\s*days?/i.exec(
    lines.join(" "),
  )?.[1];
  const validUntil =
    quoteDate && dayCount ? addDays(quoteDate, Number(dayCount)) : null;
  return { quoteRef, quoteDate, validUntil };
}

export async function parseAksPdf(file: {
  originalname: string;
  buffer: Buffer;
}): Promise<{ info: AksFilePreview; items: AksItem[] }> {
  const signature = file.buffer.subarray(0, 1024).toString("latin1");
  if (!signature.includes("%PDF-"))
    throw new HttpError(400, `${file.originalname} is not a valid PDF`);

  let pdf: Awaited<ReturnType<typeof getDocument>["promise"]>;
  // The PDF library works with Uint8Array in Node.js. Copy the uploaded buffer
  // since pdfjs may transfer/detach the underlying ArrayBuffer internally.
  try {
    const task = getDocument({
      data: new Uint8Array(file.buffer),
      useSystemFonts: true,
    });
    pdf = await task.promise;
  } catch {
    throw new HttpError(
      400,
      `Unable to read ${file.originalname}. Check that it is a valid, unencrypted PDF.`,
    );
  }

  try {
    if (pdf.numPages > 50)
      throw new HttpError(
        400,
        `${file.originalname}: maximum 50 PDF pages per document`,
      );
    const allLines: string[] = [];
    const items: AksItem[] = [];
    const notes: string[] = [];
    let unparsedRows = 0;
    const byPage: Array<{ page: number; rows: string[] }> = [];

    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const runs = content.items.flatMap((item) =>
        "str" in item && "transform" in item
          ? [{ str: item.str, transform: [...item.transform] }]
          : [],
      );
      const pageRows = logicalRows(runs);
      allLines.push(...pageRows);
      byPage.push({ page: number, rows: pageRows });
    }
    const details = metadata(allLines);
    for (const page of byPage) {
      // Parse only pages containing the expected quotation table heading.
      const headerAt = page.rows.findIndex(
        (r) =>
          /\bPart\s*No\.?\b/i.test(r) &&
          /\bDescription\b/i.test(r) &&
          /\bPrice\b/i.test(r),
      );
      if (headerAt < 0) continue;
      // An AKS item can span multiple text baselines. Group all physical
      // lines belonging to the same numbered/part-numbered item, then parse.
      const rowStart =
        /^(?:\d{1,4}\s+)?[A-Z]{2,}[A-Z0-9/_-]*\d[A-Z0-9/_-]*(?=\s|$)/i;
      let pending: { start: number; lines: string[] } | null = null;

      const flush = () => {
        if (!pending) return;
        const parsed = parseAksRowBlock(pending.lines);
        if (!parsed) {
          unparsedRows += 1;
          notes.push(
            `Page ${page.page}, table row ${pending.start + 1} (${pending.lines[0].slice(0, 65)}) could not be parsed. Check the PDF layout.`,
          );
        } else {
          items.push({
            ...parsed,
            ...details,
            sourceFile: file.originalname.slice(0, 255),
            sourcePage: page.page,
            sourceRow: pending.start + 1,
          });
        }
        pending = null;
      };

      for (let index = headerAt + 1; index < page.rows.length; index += 1) {
        const text = page.rows[index];
        if (
          /\bQuote\s*Terms\b|Agreement and Terms|Yours sincerely/i.test(text)
        ) {
          flush();
          break;
        }
        if (rowStart.test(text)) {
          flush();
          pending = { start: index, lines: [text] };
        } else if (pending) {
          // Keep extra description lines even when price/UOM/MOQ were already
          // extracted from an earlier physical line.
          pending.lines.push(text);
        }
      }
      flush();
    }
    if (!items.length) {
      throw new HttpError(
        400,
        `${file.originalname}: no AKS price rows found. It may be scanned or use a different quotation layout.`,
      );
    }
    if (!details.quoteDate)
      notes.push(
        "Quotation date not detected; check whether prices are still valid.",
      );
    if (!details.validUntil)
      notes.push(
        "Price-validity period not detected; confirm pricing with AKS.",
      );
    return {
      items,
      info: {
        filename: file.originalname.slice(0, 255),
        pages: pdf.numPages,
        count: items.length,
        ...details,
        notes,
        unparsedRows,
      },
    };
  } finally {
    await pdf.destroy();
  }
}

export async function parseAksBatch(
  files: Array<{ originalname: string; buffer: Buffer }>,
): Promise<AksBatch> {
  if (files.length === 0 || files.length > 8)
    throw new HttpError(400, "Choose between 1 and 8 PDF files");
  const size = files.reduce((sum, file) => sum + file.buffer.length, 0);
  if (size > 32 * 1024 * 1024)
    throw new HttpError(400, "Maximum combined upload size is 32 MB");
  const infos: AksFilePreview[] = [];
  const items: AksItem[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    const parsed = await parseAksPdf(file);
    infos.push(parsed.info);
    items.push(...parsed.items);
    warnings.push(
      ...parsed.info.notes.map((note) => `${file.originalname}: ${note}`),
    );
  }
  if (items.length > 10_000)
    throw new HttpError(400, "Too many AKS price rows (maximum 10,000)");
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.partNo)) duplicates.add(item.partNo);
    seen.add(item.partNo);
  }
  if (duplicates.size)
    warnings.push(
      "Duplicate part numbers detected across the selected PDFs. Remove overlapping documents and preview again.",
    );
  const hash = crypto.createHash("sha256");
  files.forEach((file) =>
    hash.update(crypto.createHash("sha256").update(file.buffer).digest()),
  );
  return {
    files: infos,
    items,
    duplicates: [...duplicates].sort(),
    totalItems: items.length,
    ready:
      items.length > 0 &&
      duplicates.size === 0 &&
      infos.every((f) => f.unparsedRows === 0),
    warnings,
    fingerprint: hash.digest("hex"),
  };
}
