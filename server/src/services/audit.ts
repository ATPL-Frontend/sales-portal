import { db } from '../config/db.js';
export async function audit(actorId: number | null, action: string, targetType?: string, targetId?: string, details?: object) {
  await db.execute('INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details) VALUES (?,?,?,?,?)',
    [actorId, action, targetType ?? null, targetId ?? null, details ? JSON.stringify(details) : null]);
}
