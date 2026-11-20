import bcrypt from 'bcryptjs';
import { db, rows } from '../config/db.js';
import { env } from '../config/env.js';
import type { RowDataPacket } from 'mysql2';
const predefined: [string, string][] = [
  ['dashboard:view','Access the dashboard'],
  ['users:read','View user directory'],
  ['users:manage','Create and update users'],
  ['roles:manage','Create roles and assign permissions'],
  ['prices:read','View and search supplier cable price lists'],
  ['prices:upload','Preview and import monthly supplier spreadsheets'],
  ['prices:manage','Manage supplier price versions']
];
for (const [key, description] of predefined) await db.execute('INSERT INTO permissions(permission_key,description) VALUES (?,?) ON DUPLICATE KEY UPDATE description=VALUES(description)', [key, description]);
for (const [name, description] of [['super_admin','Full system access'],['sales','Sales search access'],['viewer','Read-only access']]) {
  await db.execute('INSERT INTO roles(name,description,is_system) VALUES (?,?,TRUE) ON DUPLICATE KEY UPDATE description=VALUES(description)', [name, description]);
}
const [superRole] = await rows<RowDataPacket>("SELECT id FROM roles WHERE name='super_admin'");
const perms = await rows<RowDataPacket>('SELECT id FROM permissions');
for (const p of perms) await db.execute('INSERT IGNORE INTO role_permissions(role_id,permission_id) VALUES (?,?)', [superRole.id, p.id]);
for (const roleName of ['sales','viewer']) {
  const [role] = await rows<RowDataPacket>('SELECT id FROM roles WHERE name=?', [roleName]);
  for (const key of roleName === 'sales' ? ['dashboard:view','prices:read'] : ['dashboard:view']) {
    const [permission] = await rows<RowDataPacket>('SELECT id FROM permissions WHERE permission_key=?', [key]);
    await db.execute('INSERT IGNORE INTO role_permissions(role_id,permission_id) VALUES (?,?)', [role.id, permission.id]);
  }
}
const email = env.SEED_ADMIN_EMAIL.toLowerCase();
const existing = await rows<RowDataPacket>('SELECT id FROM users WHERE email=?', [email]);
if (existing.length === 0) {
  const hash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);
  await db.execute('INSERT INTO users(full_name,email,password_hash,must_change_password) VALUES (?,?,?,TRUE)', ['System Administrator', email, hash]);
  console.log(`Initial super admin created: ${email}. Password change required at first login.`);
} else { console.log('Admin already exists; password was not reset.'); }
const [admin] = await rows<RowDataPacket>('SELECT id FROM users WHERE email=?', [email]);
await db.execute('INSERT IGNORE INTO user_roles(user_id,role_id) VALUES (?,?)', [admin.id, superRole.id]);
await db.end();
