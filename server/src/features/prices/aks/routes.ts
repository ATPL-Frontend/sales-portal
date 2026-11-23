import { Router } from 'express';
import multer from 'multer';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { db, rows } from '../../../config/db.js';
import { authenticate, requirePermission } from '../../../middleware/auth.js';
import { HttpError } from '../../../utils/errors.js';
import { parseAksBatch, type AksItem } from './parser.js';

export const aksRouter = Router();
aksRouter.use(authenticate);

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 8, fileSize: 8 * 1024 * 1024, fields: 2 },
  fileFilter: (_req, file, cb) => {
    if (!/\.pdf$/i.test(file.originalname)) return cb(new HttpError(400, 'Only PDF files are supported'));
    cb(null, true);
  },
}).array('files', 8);

function uploadedFiles(req: { files?: unknown }): Express.Multer.File[] {
  const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
  if (!files.length) throw new HttpError(400, 'Select at least one AKS PDF');
  return files;
}

aksRouter.get('/meta', requirePermission('prices:read'), async (_req, res) => {
  const [active] = await rows<RowDataPacket>(`
    SELECT id, imported_at AS importedAt, file_count AS fileCount,
           item_count AS itemCount, files_json AS files
    FROM aks_imports ORDER BY id DESC LIMIT 1
  `);
  if (!active) {
    res.json({ active: null });
    return;
  }
  const files = typeof active.files === 'string' ? JSON.parse(active.files) : active.files;
  res.json({ active: { ...active, files } });
});

aksRouter.get('/items', requirePermission('prices:read'), async (req, res) => {
  const input = z.object({
    q: z.string().trim().max(150).default(''),
    sourceFile: z.string().trim().max(255).default(''),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).parse(req.query);
  const [active] = await rows<RowDataPacket>('SELECT id FROM aks_imports ORDER BY id DESC LIMIT 1');
  if (!active) {
    res.json({ items: [], total: 0, page: input.page, limit: input.limit });
    return;
  }
  const conditions: string[] = ['import_id=?'];
  const values: Array<string | number> = [active.id];
  if (input.sourceFile) {
    conditions.push('source_file=?');
    values.push(input.sourceFile);
  }
  if (input.q) {
    conditions.push('(INSTR(LOWER(part_no),LOWER(?))>0 OR INSTR(LOWER(description),LOWER(?))>0 OR INSTR(LOWER(quote_ref),LOWER(?))>0)');
    values.push(input.q, input.q, input.q);
  }
  const where = conditions.join(' AND ');
  const [summary] = await rows<RowDataPacket>(`SELECT COUNT(*) AS total FROM aks_items WHERE ${where}`, values);
  const items = await rows<RowDataPacket>(`
    SELECT id, part_no AS partNo, description, price, uom, moq,
           quote_ref AS quoteRef, DATE_FORMAT(quote_date,'%Y-%m-%d') AS quoteDate,
           DATE_FORMAT(valid_until,'%Y-%m-%d') AS validUntil,
           source_file AS sourceFile, source_page AS sourcePage
    FROM aks_items WHERE ${where}
    ORDER BY part_no,id LIMIT ? OFFSET ?
  `, [...values, input.limit, (input.page - 1) * input.limit]);
  res.json({ items, total: Number(summary.total), page: input.page, limit: input.limit });
});

aksRouter.post('/preview', requirePermission('prices:upload'), pdfUpload, async (req, res) => {
  const batch = await parseAksBatch(uploadedFiles(req));
  res.json({ preview: {
    files: batch.files,
    totalItems: batch.totalItems,
    duplicates: batch.duplicates,
    ready: batch.ready,
    warnings: batch.warnings,
    sample: batch.items.slice(0, 60),
  }});
});

aksRouter.post('/import', requirePermission('prices:upload'), pdfUpload, async (req, res) => {
  const batch = await parseAksBatch(uploadedFiles(req));
  if (!batch.ready) throw new HttpError(400, `Duplicate AKS part numbers: ${batch.duplicates.slice(0, 10).join(', ')}. Remove overlapping files and retry.`);
  const connection = await db.getConnection();
  let importId = 0;
  try {
    await connection.beginTransaction();
    // Row lock serializes concurrent AKS replacements, independently of 3F.
    const [supplier] = await connection.execute<RowDataPacket[]>(
      'SELECT code FROM price_suppliers WHERE code=? FOR UPDATE', ['aks']
    );
    if (!supplier.length) throw new HttpError(500, 'AKS supplier not initialized. Import server/sql/aks.sql in phpMyAdmin.');

    // Delete only AKS batches. Foreign-key cascade deletes their old items.
    // Any failure before COMMIT rolls back and restores the previous AKS list.
    await connection.execute('DELETE FROM aks_imports');
    const [header] = await connection.execute<ResultSetHeader>(`
      INSERT INTO aks_imports(files_json,file_count,item_count,imported_by)
      VALUES (?,?,?,?)
    `, [JSON.stringify(batch.files), batch.files.length, batch.totalItems, req.authUser!.id]);
    importId = header.insertId;
    for (let start = 0; start < batch.items.length; start += 100) {
      const group = batch.items.slice(start, start + 100);
      const placeholders = group.map(() => `(${Array(12).fill('?').join(',')})`).join(',');
      const values = group.flatMap((item: AksItem) => [
        importId, item.partNo, item.description, item.price, item.uom,
        item.moq, item.quoteRef, item.quoteDate, item.validUntil,
        item.sourceFile, item.sourcePage, item.sourceRow,
      ]);
      await connection.query(`
        INSERT INTO aks_items
          (import_id,part_no,description,price,uom,moq,quote_ref,quote_date,
           valid_until,source_file,source_page,source_row)
        VALUES ${placeholders}
      `, values);
    }
    await connection.execute(`
      INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
      VALUES (?,?,?,?,?)
    `, [req.authUser!.id, 'prices.replace', 'aks_import', String(importId),
      JSON.stringify({ supplier: 'aks', count: batch.totalItems, files: batch.files.map(f => f.filename), fingerprint: batch.fingerprint })]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.status(201).json({
    message: 'AKS price list replaced', importId, count: batch.totalItems,
    fileCount: batch.files.length,
  });
});
