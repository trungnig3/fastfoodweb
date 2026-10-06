import { Request, Response, NextFunction } from 'express';
import path from 'path';
import ejs from 'ejs';
import { db } from '../db.js';

// Layout rendering helper for Admin
export async function renderAdmin(req: Request, res: Response, viewName: string, title: string, data: Record<string, any> = {}) {
  const viewPath = path.join(process.cwd(), 'views', 'admin', `${viewName}.ejs`);
  const body = await ejs.renderFile(viewPath, data);
  const layoutPath = path.join(process.cwd(), 'views', 'admin_layout.ejs');
  const fullHtml = await ejs.renderFile(layoutPath, {
    title,
    body,
    path: req.path.toLowerCase(),
    user: req.session.user
  });
  res.send(fullHtml);
}

// Layout rendering helper for Cashier
export async function renderCashier(req: Request, res: Response, viewName: string, title: string, data: Record<string, any> = {}) {
  const viewPath = path.join(process.cwd(), 'views', 'cashier', `${viewName}.ejs`);
  const body = await ejs.renderFile(viewPath, data);
  const layoutPath = path.join(process.cwd(), 'views', 'admin_layout.ejs');
  const fullHtml = await ejs.renderFile(layoutPath, {
    title,
    body,
    path: req.path.toLowerCase(),
    user: req.session.user
  });
  res.send(fullHtml);
}

// Authentication check
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) {
    return next();
  }
  return res.redirect('/Account/Login');
}

// Role isolation: Admin or Manager only
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.redirect('/Account/Login');
  }
  const role = db.getRoleById(req.session.user.RoleId);
  const roleName = role ? role.RoleName : req.session.user.RoleName;
  if (roleName === 'Admin' || roleName === 'Manager') {
    return next();
  }
  if (roleName === 'Cashier') {
    return res.redirect('/Cashier');
  }
  return res.redirect('/Shop');
}

// Role isolation: Cashier only
export function requireCashier(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.redirect('/Account/Login');
  }
  const role = db.getRoleById(req.session.user.RoleId);
  const roleName = role ? role.RoleName : req.session.user.RoleName;
  if (roleName === 'Cashier') {
    return next();
  }
  if (roleName === 'Admin' || roleName === 'Manager') {
    return res.redirect('/Admin');
  }
  return res.redirect('/Shop');
}

// POS access (Cashier)
export function requirePos(req: Request, res: Response, next: NextFunction) {
  return requireCashier(req, res, next);
}
