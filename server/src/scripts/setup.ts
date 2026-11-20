import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../sql/schema.sql');
const sql = await readFile(file, 'utf8');
const connection = await mysql.createConnection({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, multipleStatements: true });
try { await connection.query(sql); console.log('Database tables are ready. Run npm run db:seed.'); }
finally { await connection.end(); }
