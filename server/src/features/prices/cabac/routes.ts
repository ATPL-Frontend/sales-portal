import { Router } from "express";
import multer from "multer";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { db, rows } from "../../../config/db.js";
import { authenticate, requirePermission } from "../../../middleware/auth.js";
import { HttpError } from "../../../utils/errors.js";
import { parseCabacWorkbook } from "./workbook.js";

export const cabacRouter = Router();
cabacRouter.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/\.xlsx?$/i.test(file.originalname))
      return cb(new HttpError(400, "Excel .xls or .xlsx files only"));
    cb(null, true);
  },
}).single("workbook");

cabacRouter.get(
  "/meta",
  requirePermission("prices:read"),
  async (_req, res) => {
    const [active] = await rows<RowDataPacket>(`
    SELECT id, filename, item_count AS itemCount, imported_at AS importedAt
    FROM cabac_imports ORDER BY id DESC LIMIT 1
  `);
    res.json({ active: active ?? null });
  },
);

cabacRouter.get(
  "/items",
  requirePermission("prices:read"),
  async (req, res) => {
    const input = z
      .object({
        q: z.string().trim().max(150).default(""),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(req.query);
    const [active] = await rows<RowDataPacket>(
      "SELECT id FROM cabac_imports ORDER BY id DESC LIMIT 1",
    );
    if (!active) {
      res.json({ items: [], total: 0, page: input.page, limit: input.limit });
      return;
    }
    const conditions = ["import_id=?"];
    const values: Array<string | number> = [active.id as number];
    if (input.q) {
      conditions.push(
        "(INSTR(LOWER(item_code), LOWER(?)) > 0 OR INSTR(LOWER(item_description), LOWER(?)) > 0)",
      );
      values.push(input.q, input.q);
    }
    const where = conditions.join(" AND ");
    const [summary] = await rows<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM cabac_items WHERE ${where}`,
      values,
    );
    const items = await rows<RowDataPacket>(
      `
    SELECT id, item_code AS itemCode, item_description AS itemDescription,
      quantity, quantity_per AS quantityPer, unit, offer_price AS offerPrice,
      currency FROM cabac_items WHERE ${where}
    ORDER BY item_code, id LIMIT ? OFFSET ?
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

cabacRouter.post(
  "/preview",
  requirePermission("prices:upload"),
  upload,
  async (req, res) => {
    if (!req.file) throw new HttpError(400, "Select a CABAC workbook");
    const parsed = parseCabacWorkbook(req.file.buffer, req.file.originalname);
    res.json({ preview: parsed.preview });
  },
);

cabacRouter.post(
  "/import",
  requirePermission("prices:upload"),
  upload,
  async (req, res) => {
    if (!req.file) throw new HttpError(400, "Select a CABAC workbook");
    const parsed = parseCabacWorkbook(req.file.buffer, req.file.originalname);
    if (!parsed.preview.ready) {
      throw new HttpError(
        400,
        `Import blocked: ${parsed.preview.warnings[0] ?? "no valid items"}`,
      );
    }
    const connection = await db.getConnection();
    let importId = 0;
    try {
      await connection.beginTransaction();
      const [supplier] = await connection.execute<RowDataPacket[]>(
        "SELECT code FROM price_suppliers WHERE code=? FOR UPDATE",
        ["cabac"],
      );
      if (!supplier.length)
        throw new HttpError(
          500,
          "CABAC supplier not found: import server/sql/cabac.sql first",
        );

      // Replaces ONLY CABAC data, inside the same transaction as the new records.
      await connection.execute(
        "DELETE FROM cabac_imports WHERE supplier_code=?",
        ["cabac"],
      );
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO cabac_imports (supplier_code,filename,item_count,imported_by)
       VALUES ('cabac',?,?,?)`,
        [
          req.file.originalname.slice(0, 255),
          parsed.lines.length,
          req.authUser!.id,
        ],
      );
      importId = result.insertId;
      for (let start = 0; start < parsed.lines.length; start += 200) {
        const batch = parsed.lines.slice(start, start + 200);
        const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",");
        const params = batch.flatMap((item) => [
          importId,
          item.itemCode,
          item.itemDescription,
          item.quantity,
          item.quantityPer,
          item.unit,
          item.offerPrice,
          item.currency,
          item.sheetName,
          item.sourceRow,
        ]);
        await connection.query(
          `
        INSERT INTO cabac_items
          (import_id,item_code,item_description,quantity,quantity_per,unit,
           offer_price,currency,sheet_name,source_row)
        VALUES ${placeholders}
      `,
          params,
        );
      }
      await connection.execute(
        `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
       VALUES (?,?,?,?,?)`,
        [
          req.authUser!.id,
          "prices.replace",
          "cabac_import",
          String(importId),
          JSON.stringify({
            supplier: "cabac",
            filename: req.file.originalname,
            count: parsed.lines.length,
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
        message: "CABAC price list replaced",
        importId,
        count: parsed.lines.length,
      });
  },
);
