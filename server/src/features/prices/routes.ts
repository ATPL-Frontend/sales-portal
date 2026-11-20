import { Router } from "express";
import multer from "multer";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import crypto from "node:crypto";
import { z } from "zod";
import { db, rows } from "../../config/db.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { HttpError } from "../../utils/errors.js";
import { parsePriceWorkbook, type PriceLine } from "./workbook.js";

export const priceRouter = Router();
priceRouter.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /\.xlsx?$/i.test(file.originalname)),
}).single("workbook");

const decodeSelections = (value: unknown): Record<string, string> => {
  if (value == null || value === "") return {};
  try {
    return z
      .record(z.string(), z.string().min(1))
      .parse(JSON.parse(String(value)));
  } catch {
    throw new HttpError(400, "Invalid worksheet price range selection");
  }
};

priceRouter.get(
  "/suppliers",
  requirePermission("prices:read"),
  async (_req, res) => {
    const suppliers = await rows<RowDataPacket>(
      "SELECT code, display_name AS name FROM price_suppliers ORDER BY display_name",
    );
    res.json({ suppliers });
  },
);

priceRouter.get(
  "/3f/meta",
  requirePermission("prices:read"),
  async (_req, res) => {
    const [active] = await rows<RowDataPacket>(`
    SELECT id,DATE_FORMAT(effective_month,'%Y-%m') AS month,filename,item_count AS itemCount,
      imported_at AS importedAt FROM price_imports
    WHERE supplier_code='3f' ORDER BY id DESC LIMIT 1`);
    const categories = active
      ? await rows<RowDataPacket>(
          `
    SELECT category,COUNT(*) AS count FROM price_items WHERE import_id=? GROUP BY category ORDER BY category`,
          [active.id],
        )
      : [];
    res.json({ active: active ?? null, categories });
  },
);

priceRouter.get(
  "/3f/items",
  requirePermission("prices:read"),
  async (req, res) => {
    const input = z
      .object({
        q: z.string().trim().max(150).default(""),
        category: z.string().trim().max(255).default(""),
        page: z.coerce.number().int().min(1).max(100_000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);
    const [selected] = await rows<RowDataPacket>(
      `SELECT id FROM price_imports WHERE supplier_code='3f' ORDER BY id DESC LIMIT 1`,
    );
    if (!selected) {
      res.json({ items: [], total: 0, page: input.page, limit: input.limit });
      return;
    }
    const filters: string[] = ["import_id=?"];
    const params: unknown[] = [selected.id];
    if (input.category) {
      filters.push("category=?");
      params.push(input.category);
    }
    if (input.q) {
      filters.push(
        "(INSTR(LOWER(description),LOWER(?))>0 OR INSTR(LOWER(category),LOWER(?))>0 OR INSTR(LOWER(ul_code),LOWER(?))>0)",
      );
      params.push(input.q, input.q, input.q);
    }
    const where = filters.join(" AND ");
    const [totals] = await rows<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM price_items WHERE ${where}`,
      params,
    );
    const items = await rows<RowDataPacket>(
      `
    SELECT id,sheet_name AS sheetName,category,ul_code AS ul,source_item_no AS itemNo,
      description,unit_price AS price,price_range AS priceRange,
      packing_roll AS packing,moq,lead_time AS leadTime,source_row AS sourceRow
    FROM price_items WHERE ${where}
    ORDER BY category, sheet_name, source_row, id LIMIT ? OFFSET ?`,
      [...params, input.limit, (input.page - 1) * input.limit],
    );
    res.json({
      items,
      total: totals.total,
      page: input.page,
      limit: input.limit,
    });
  },
);

priceRouter.post(
  "/3f/preview",
  requirePermission("prices:upload"),
  upload,
  async (req, res) => {
    if (!req.file)
      throw new HttpError(
        400,
        "Choose an Excel .xls or .xlsx workbook (maximum 8 MB)",
      );
    const parsed = await parsePriceWorkbook(
      req.file.buffer,
      req.file.originalname,
      decodeSelections(req.body?.selections),
    );
    const { lines: _lines, ...preview } = parsed;
    res.json({ preview });
  },
);

priceRouter.post(
  "/3f/import",
  requirePermission("prices:upload"),
  upload,
  async (req, res) => {
    if (!req.file) throw new HttpError(400, "Choose an Excel workbook");
    const parsed = await parsePriceWorkbook(
      req.file.buffer,
      req.file.originalname,
      decodeSelections(req.body?.selections),
    );
    if (!parsed.allSelected)
      throw new HttpError(
        400,
        "Select a valid price range for every worksheet before importing",
      );
    if (!parsed.lines.length)
      throw new HttpError(400, "No valid price rows to import");
    if (parsed.lines.length > 20000)
      throw new HttpError(400, "Too many price rows in one import");
    const sha = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");
    const connection = await db.getConnection();
    let id: number;
    try {
      await connection.beginTransaction();
      // Only one 3F import can replace the list at a time.
      const [suppliers] = await connection.execute<RowDataPacket[]>(
        "SELECT code FROM price_suppliers WHERE code=? FOR UPDATE",
        ["3f"],
      );
      if (!suppliers.length)
        throw new HttpError(500, "Supplier 3F is missing. Run db:setup.");

      // Deletes previous 3F imports AND all related price_items (ON DELETE CASCADE).
      // A failed import rolls back this deletion and restores the previous list.
      await connection.execute(
        "DELETE FROM price_imports WHERE supplier_code=?",
        ["3f"],
      );

      // Existing schema requires effective_month; set it automatically to today's date.
      const [result] = await connection.execute<ResultSetHeader>(
        `
      INSERT INTO price_imports(supplier_code,effective_month,filename,file_sha256,imported_by,item_count,active)
      VALUES ('3f',CURRENT_DATE(),?,?,?,?,TRUE)`,
        [
          req.file.originalname.slice(0, 255),
          sha,
          req.authUser!.id,
          parsed.lines.length,
        ],
      );
      id = result.insertId;
      const chunks = (items: PriceLine[], size: number) =>
        Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
          items.slice(i * size, (i + 1) * size),
        );
      for (const group of chunks(parsed.lines, 200)) {
        const values = group.flatMap((line) => [
          id,
          line.sheetName,
          line.category,
          line.ul,
          line.itemNo,
          line.description,
          line.price,
          line.priceRange,
          line.packing,
          line.moq,
          line.leadTime,
          line.sourceRow,
        ]);
        const placeholders = group
          .map(() => `(${Array(12).fill("?").join(",")})`)
          .join(",");
        await connection.query(
          `
        INSERT INTO price_items(import_id,sheet_name,category,ul_code,source_item_no,description,
          unit_price,price_range,packing_roll,moq,lead_time,source_row) VALUES ${placeholders}`,
          values,
        );
      }
      await connection.execute(
        `INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
      VALUES (?,?,?,?,?)`,
        [
          req.authUser!.id,
          "prices.replace",
          "price_import",
          String(id),
          JSON.stringify({
            supplier: "3f",
            filename: req.file.originalname,
            count: parsed.lines.length,
            sheets: parsed.sheets.map((s) => ({
              name: s.name,
              tier: s.selectedRange,
              items: s.items,
              skipped: s.skipped,
            })),
          }),
        ],
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
    res.status(201).json({
      message: "3F price list replaced",
      importId: id,
      count: parsed.lines.length,
    });
  },
);
