import { Router } from "express";
import multer from "multer";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { db, rows } from "../../../config/db.js";
import { authenticate, requirePermission } from "../../../middleware/auth.js";
import { HttpError } from "../../../utils/errors.js";
import { parseCarrollWorkbook } from "./workbook.js";

export const carrollRouter = Router();
carrollRouter.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!/\.xlsx?$/i.test(file.originalname)) {
      callback(
        new HttpError(400, "Only Excel .xls or .xlsx workbooks are accepted."),
      );
      return;
    }
    callback(null, true);
  },
}).single("workbook");

carrollRouter.get(
  "/meta",
  requirePermission("prices:read"),
  async (_req, res) => {
    const [active] = await rows<RowDataPacket>(`
    SELECT id, filename, item_count AS itemCount,
           DATE_FORMAT(effective_date, '%Y-%m-%d') AS effectiveDate,
           imported_at AS importedAt
    FROM carroll_imports WHERE supplier_code = 'carroll' ORDER BY id DESC LIMIT 1
  `);
    res.json({ active: active ?? null });
  },
);

carrollRouter.get(
  "/items",
  requirePermission("prices:read"),
  async (req, res) => {
    const input = z
      .object({
        q: z.string().trim().max(150).default(""),
        category: z.string().trim().max(255).default(""),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(req.query);
    const [active] = await rows<RowDataPacket>(
      "SELECT id FROM carroll_imports WHERE supplier_code='carroll' ORDER BY id DESC LIMIT 1",
    );
    if (!active) {
      res.json({ items: [], total: 0, page: input.page, limit: input.limit });
      return;
    }
    const conditions = ["import_id=?"];
    const values: Array<string | number> = [Number(active.id)];
    if (input.q) {
      conditions.push(`(
      INSTR(LOWER(part_number), LOWER(?)) > 0 OR
      INSTR(LOWER(description), LOWER(?)) > 0 OR
      INSTR(LOWER(category_discount_code), LOWER(?)) > 0 OR
      INSTR(LOWER(category_product), LOWER(?)) > 0
    )`);
      values.push(input.q, input.q, input.q, input.q);
    }
    if (input.category) {
      conditions.push("category_product=?");
      values.push(input.category);
    }
    const where = conditions.join(" AND ");
    const [summary] = await rows<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM carroll_items WHERE ${where}`,
      values,
    );
    const items = await rows<RowDataPacket>(
      `
    SELECT id, part_number AS partNumber, description,
      per_pack_list_price AS perPackListPrice,
      quantity_per_pack AS quantityPerPack,
      per_pack_net_price AS perPackNetPrice,
      discount_percent AS discountPercent,
      category_discount_code AS categoryDiscountCode,
      category_product AS categoryProduct
    FROM carroll_items WHERE ${where}
    ORDER BY part_number, id LIMIT ? OFFSET ?
  `,
      [...values, input.limit, (input.page - 1) * input.limit],
    );
    res.json({
      items,
      total: Number(summary.total),
      page: input.page,
      limit: input.limit,
    });
  },
);

carrollRouter.get(
  "/categories",
  requirePermission("prices:read"),
  async (_req, res) => {
    const [active] = await rows<RowDataPacket>(
      "SELECT id FROM carroll_imports WHERE supplier_code='carroll' ORDER BY id DESC LIMIT 1",
    );
    if (!active) {
      res.json({ categories: [] });
      return;
    }
    const categories = await rows<RowDataPacket>(
      `
    SELECT category_product AS name, COUNT(*) AS count
    FROM carroll_items WHERE import_id=? GROUP BY category_product ORDER BY category_product
  `,
      [Number(active.id)],
    );
    res.json({ categories });
  },
);

carrollRouter.post(
  "/preview",
  requirePermission("prices:upload"),
  upload,
  async (req, res) => {
    if (!req.file) throw new HttpError(400, "Select a Carroll Excel workbook");
    const parsed = parseCarrollWorkbook(req.file.buffer, req.file.originalname);
    res.json({ preview: parsed.preview });
  },
);

carrollRouter.post(
  "/import",
  requirePermission("prices:upload"),
  upload,
  async (req, res) => {
    if (!req.file) throw new HttpError(400, "Select a Carroll Excel workbook");
    const parsed = parseCarrollWorkbook(req.file.buffer, req.file.originalname);
    if (!parsed.preview.ready) {
      throw new HttpError(
        400,
        `Import not ready: ${parsed.preview.warnings[0] ?? "no valid items found"}`,
      );
    }
    const connection = await db.getConnection();
    let importId = 0;
    try {
      await connection.beginTransaction();
      const [supplier] = await connection.execute<RowDataPacket[]>(
        "SELECT code FROM price_suppliers WHERE code=? FOR UPDATE",
        ["carroll"],
      );
      if (!supplier.length)
        throw new HttpError(
          500,
          "Carroll supplier not found. Import server/sql/carroll.sql first.",
        );

      // Delete and replace Carroll only. On any failure rollback preserves previous data.
      await connection.execute(
        "DELETE FROM carroll_imports WHERE supplier_code='carroll'",
      );
      const [insert] = await connection.execute<ResultSetHeader>(
        `
      INSERT INTO carroll_imports (supplier_code, filename, effective_date, item_count, imported_by)
      VALUES ('carroll', ?, ?, ?, ?)
    `,
        [
          req.file.originalname.slice(0, 255),
          parsed.preview.effectiveDate,
          parsed.lines.length,
          req.authUser!.id,
        ],
      );
      importId = insert.insertId;
      for (let start = 0; start < parsed.lines.length; start += 200) {
        const batch = parsed.lines.slice(start, start + 200);
        const placeholders = batch
          .map(() => "(?,?,?,?,?,?,?,?,?,?,?)")
          .join(",");
        const values = batch.flatMap((item) => [
          importId,
          item.partNumber,
          item.description,
          item.perPackListPrice,
          item.quantityPerPack,
          item.perPackNetPrice,
          item.discountPercent,
          item.categoryDiscountCode,
          item.categoryProduct,
          item.sheetName,
          item.sourceRow,
        ]);
        await connection.query(
          `
        INSERT INTO carroll_items (import_id, part_number, description,
          per_pack_list_price, quantity_per_pack, per_pack_net_price,
          discount_percent, category_discount_code, category_product, sheet_name, source_row)
        VALUES ${placeholders}
      `,
          values,
        );
      }
      await connection.execute(
        `
      INSERT INTO audit_logs (actor_user_id,action,target_type,target_id,details)
      VALUES (?,?,?,?,?)
    `,
        [
          req.authUser!.id,
          "prices.replace",
          "carroll_import",
          String(importId),
          JSON.stringify({
            supplier: "carroll",
            filename: req.file.originalname,
            count: parsed.lines.length,
            effectiveDate: parsed.preview.effectiveDate,
          }),
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res
      .status(201)
      .json({
        message: "Carroll price list replaced",
        count: parsed.lines.length,
        importId,
      });
  },
);
