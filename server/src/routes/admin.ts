import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, rows } from '../config/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { getRoles } from '../services/users.js';
import { audit } from '../services/audit.js';
import { HttpError } from '../utils/errors.js';
export const adminRouter = Router();
adminRouter.use(authenticate, requireSuperAdmin);
const numericId = z.coerce.number().int().positive();
adminRouter.get('/overview', async (_req, res) => {
  const [u] = await rows<RowDataPacket>('SELECT COUNT(*) AS total, SUM(is_active=1) AS active FROM users');
  const [r] = await rows<RowDataPacket>('SELECT COUNT(*) AS total FROM roles');
  const [a] = await rows<RowDataPacket>('SELECT COUNT(*) AS total FROM audit_logs');
  res.json({ users: Number(u.total), activeUsers: Number(u.active || 0), roles: Number(r.total), auditEvents: Number(a.total) });
});
adminRouter.get('/users', async (_req, res) => {
  const users = await rows<RowDataPacket>('SELECT id, full_name, email, is_active, must_change_password, created_at FROM users ORDER BY created_at DESC');
  res.json({ users: await Promise.all(users.map(async u => ({ id: u.id, fullName: u.full_name, email: u.email, active: Boolean(u.is_active), mustChangePassword: Boolean(u.must_change_password), createdAt: u.created_at, roles: await getRoles(u.id) }))) });
});
adminRouter.post('/users', async (req, res) => {
  const input = z.object({ fullName: z.string().trim().min(2).max(140), email: z.string().email().max(254), password: z.string().min(12).max(128), roleIds: z.array(numericId).max(12).default([]) }).parse(req.body);
  const email = input.email.toLowerCase().trim();
  const roleIds = [...new Set(input.roleIds)];
  if (roleIds.length) {
    const found = await rows<RowDataPacket>(`SELECT id FROM roles WHERE id IN (${roleIds.map(() => '?').join(',')}) AND name <> 'super_admin'`, roleIds);
    if (found.length !== roleIds.length) throw new HttpError(400, 'Invalid or restricted role selected');
  }
  const conn = await db.getConnection(); let id: number;
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<ResultSetHeader>('INSERT INTO users (full_name,email,password_hash,must_change_password) VALUES (?,?,?,TRUE)', [input.fullName, email, await bcrypt.hash(input.password, 12)]);
    id = result.insertId;
    for (const roleId of roleIds) await conn.execute('INSERT INTO user_roles (user_id,role_id) VALUES (?,?)', [id, roleId]);
    await conn.commit();
  } catch (e) { await conn.rollback(); if ((e as {code?:string}).code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Email already exists'); throw e; }
  finally { conn.release(); }
  await audit(req.authUser!.id, 'user.created', 'user', String(id));
  res.status(201).json({ id, message: 'User created' });
});
adminRouter.patch('/users/:id', async (req, res) => {
  const id = numericId.parse(req.params.id);
  const input = z.object({ fullName: z.string().trim().min(2).max(140).optional(), active: z.boolean().optional(), roleIds: z.array(numericId).max(12).optional() }).parse(req.body);
  const [target] = await rows<RowDataPacket>('SELECT id FROM users WHERE id=?', [id]);
  if (!target) throw new HttpError(404, 'User not found');
  const currentRoles = await getRoles(id);
  if (currentRoles.includes('super_admin')) throw new HttpError(403, 'Protected super admin account cannot be modified here');
  if (input.roleIds) {
    const roleIds = [...new Set(input.roleIds)];
    if (roleIds.length) {
      const found = await rows<RowDataPacket>(`SELECT id FROM roles WHERE id IN (${roleIds.map(() => '?').join(',')}) AND name <> 'super_admin'`, roleIds);
      if (found.length !== roleIds.length) throw new HttpError(400, 'Invalid or restricted role selected');
    }
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (input.fullName !== undefined) await conn.execute('UPDATE users SET full_name=? WHERE id=?', [input.fullName, id]);
    if (input.active !== undefined) await conn.execute('UPDATE users SET is_active=? WHERE id=?', [input.active, id]);
    if (input.roleIds !== undefined) {
      await conn.execute('DELETE FROM user_roles WHERE user_id=?', [id]);
      for (const roleId of new Set(input.roleIds)) await conn.execute('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)', [id, roleId]);
    }
    await conn.commit();
  } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(req.authUser!.id, 'user.updated', 'user', String(id), { fields: Object.keys(input) });
  res.json({ message: 'User updated' });
});
adminRouter.get('/permissions', async (_req, res) => {
  const permissions = await rows<RowDataPacket>('SELECT id, permission_key, description FROM permissions ORDER BY permission_key');
  res.json({ permissions: permissions.map(p => ({ id: p.id, key: p.permission_key, description: p.description })) });
});
adminRouter.get('/roles', async (_req, res) => {
  const roles = await rows<RowDataPacket>('SELECT id,name,description,is_system FROM roles ORDER BY id');
  const linked = await rows<RowDataPacket>('SELECT rp.role_id, p.permission_key FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id');
  res.json({ roles: roles.map(r => ({ id: r.id, name: r.name, description: r.description, system: Boolean(r.is_system), permissions: linked.filter(p => p.role_id === r.id).map(p => p.permission_key) })) });
});
adminRouter.post('/roles', async (req, res) => {
  const input = z.object({ name: z.string().regex(/^[a-z][a-z0-9_]{2,49}$/), description: z.string().max(255).default(''), permissionKeys: z.array(z.string()).max(30).default([]) }).parse(req.body);
  const keys = [...new Set(input.permissionKeys)];
  const allowed = keys.length ? await rows<RowDataPacket>(`SELECT id FROM permissions WHERE permission_key IN (${keys.map(() => '?').join(',')})`, keys) : [];
  if (allowed.length !== keys.length) throw new HttpError(400, 'Invalid permission selected');
  const conn = await db.getConnection(); let id: number;
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<ResultSetHeader>('INSERT INTO roles(name,description) VALUES (?,?)', [input.name, input.description]); id = result.insertId;
    for (const p of allowed) await conn.execute('INSERT INTO role_permissions(role_id,permission_id) VALUES (?,?)', [id, p.id]);
    await conn.commit();
  } catch(e) { await conn.rollback(); if ((e as {code?:string}).code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Role already exists'); throw e; } finally { conn.release(); }
  await audit(req.authUser!.id, 'role.created', 'role', String(id));
  res.status(201).json({ id, message: 'Role created' });
});
adminRouter.put('/roles/:id/permissions', async (req, res) => {
  const id = numericId.parse(req.params.id);
  const { permissionKeys } = z.object({ permissionKeys: z.array(z.string()).max(30) }).parse(req.body);
  const [role] = await rows<RowDataPacket>('SELECT name,is_system FROM roles WHERE id=?', [id]);
  if (!role) throw new HttpError(404, 'Role not found');
  if (role.name === 'super_admin') throw new HttpError(403, 'Super admin permissions are immutable');
  const keys = [...new Set(permissionKeys)];
  const allowed = keys.length ? await rows<RowDataPacket>(`SELECT id FROM permissions WHERE permission_key IN (${keys.map(() => '?').join(',')})`, keys) : [];
  if (allowed.length !== keys.length) throw new HttpError(400, 'Invalid permission selected');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM role_permissions WHERE role_id=?', [id]);
    for (const p of allowed) await conn.execute('INSERT INTO role_permissions(role_id,permission_id) VALUES (?,?)', [id, p.id]);
    await conn.commit();
  } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(req.authUser!.id, 'role.permissions_updated', 'role', String(id));
  res.json({ message: 'Permissions updated' });
});
adminRouter.get('/activity', async (_req, res) => {
  const events = await rows<RowDataPacket>(`SELECT a.id, a.action, a.target_type, a.target_id, a.created_at, u.full_name AS actor
    FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.id DESC LIMIT 15`);
  res.json({ events: events.map(e => ({ id: e.id, action: e.action, targetType: e.target_type, targetId: e.target_id, at: e.created_at, actor: e.actor || 'System' })) });
});
