import mysql, { type RowDataPacket } from 'mysql2/promise';
import { env } from './env.js';
export const db = mysql.createPool({
  host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER,
  password: env.DB_PASSWORD, database: env.DB_NAME,
  waitForConnections: true, connectionLimit: 10, queueLimit: 0,
  decimalNumbers: true
});
export async function rows<T extends RowDataPacket>(sql: string, values: unknown[] = []): Promise<T[]> {
  const [result] = await db.execute<T[]>(sql, values);
  return result;
}
