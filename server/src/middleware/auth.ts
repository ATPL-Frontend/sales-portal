import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getUser, getRoles, getPermissions, type UserRow } from '../services/users.js';
import { HttpError } from '../utils/errors.js';

declare global { namespace Express { interface Request { authUser?: UserRow; authRoles?: string[]; authPermissions?: string[] } } }
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.access_token;
    if (!token) throw new HttpError(401, 'Please sign in to continue');
    const data = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof data === 'string' || !data.sub || !/^\d+$/.test(data.sub)) throw new HttpError(401, 'Invalid session');
    const user = await getUser(Number(data.sub));
    if (!user?.is_active) throw new HttpError(401, 'Session invalid or account disabled');
    req.authUser = user;
    req.authRoles = await getRoles(user.id);
    req.authPermissions = await getPermissions(user.id);
    next();
  } catch (err) { next(err instanceof jwt.JsonWebTokenError ? new HttpError(401, 'Session expired or invalid') : err); }
}
export function requirePermission(key: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.authUser?.must_change_password) return next(new HttpError(403, 'Change your initial password before continuing'));
    if (req.authRoles?.includes('super_admin') || req.authPermissions?.includes(key)) return next();
    next(new HttpError(403, 'You do not have permission for this action'));
  };
}
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.authUser?.must_change_password) return next(new HttpError(403, 'Change your initial password before continuing'));
  if (!req.authRoles?.includes('super_admin')) return next(new HttpError(403, 'Super admin access required'));
  next();
}
