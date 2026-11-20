import type { RowDataPacket } from 'mysql2';
import { rows } from '../config/db.js';
export interface UserRow extends RowDataPacket {
  id: number; full_name: string; email: string; password_hash: string;
  is_active: number; must_change_password: number; created_at: Date;
}
export async function getUser(id: number) {
  return (await rows<UserRow>('SELECT * FROM users WHERE id=?', [id]))[0];
}
export async function getByEmail(email: string) {
  return (await rows<UserRow>('SELECT * FROM users WHERE email=?', [email]))[0];
}
export async function getRoles(id: number): Promise<string[]> {
  const r = await rows<RowDataPacket>('SELECT r.name FROM roles r INNER JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=?', [id]);
  return r.map(x => String(x.name));
}
export async function getPermissions(id: number): Promise<string[]> {
  const r = await rows<RowDataPacket>(`SELECT DISTINCT p.permission_key FROM permissions p
    JOIN role_permissions rp ON rp.permission_id=p.id
    JOIN user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=?`, [id]);
  return r.map(x => String(x.permission_key));
}
export async function publicUser(user: UserRow) {
  const roles = await getRoles(user.id);
  const permissions = await getPermissions(user.id);
  return { id: user.id, fullName: user.full_name, email: user.email, active: Boolean(user.is_active),
    mustChangePassword: Boolean(user.must_change_password), roles, permissions,
    isSuperAdmin: roles.includes('super_admin') };
}
